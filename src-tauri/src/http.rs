use crate::downloads::{CancelFlags, DownloadError};
use reqwest::{header, Client, Method, Request, Response, Url};
use std::{
    collections::HashMap,
    error::Error,
    io::ErrorKind,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime},
};
use tokio::{
    sync::{OwnedSemaphorePermit, Semaphore},
    time::Instant,
};

const MAX_COOLDOWN: Duration = Duration::from_secs(60);
const ORIGIN_LIMIT: usize = 8;
const MAX_ATTEMPTS: usize = 3;

#[derive(Clone)]
pub(crate) struct Transport {
    client: Client,
    origins: Arc<Mutex<HashMap<String, Arc<Origin>>>>,
}

struct Origin {
    slots: Arc<Semaphore>,
    resume: Mutex<Instant>,
}

pub(crate) fn transient(error: &reqwest::Error) -> bool {
    if error.is_timeout() {
        return true;
    }
    let mut cause = error.source();
    while let Some(error) = cause {
        if let Some(io) = error.downcast_ref::<std::io::Error>() {
            return matches!(
                io.kind(),
                ErrorKind::Interrupted
                    | ErrorKind::TimedOut
                    | ErrorKind::BrokenPipe
                    | ErrorKind::UnexpectedEof
                    | ErrorKind::ConnectionAborted
                    | ErrorKind::ConnectionReset
                    | ErrorKind::ConnectionRefused
            );
        }
        if error.downcast_ref::<hyper::Error>().is_some_and(|e| {
            e.is_closed() || e.is_incomplete_message() || e.is_timeout() || e.is_canceled()
        }) {
            return true;
        }
        cause = error.source();
    }
    false
}

impl Transport {
    pub(crate) fn new() -> reqwest::Result<Self> {
        Ok(Self {
            client: Client::builder()
                .user_agent(concat!("kaede/", env!("CARGO_PKG_VERSION")))
                .redirect(reqwest::redirect::Policy::none())
                .retry(reqwest::retry::never())
                .connect_timeout(Duration::from_secs(15))
                .read_timeout(Duration::from_secs(30))
                .pool_idle_timeout(Duration::from_secs(90))
                .build()?,
            origins: Default::default(),
        })
    }

    fn origin(&self, url: &Url) -> Arc<Origin> {
        let key = url.origin().ascii_serialization();
        let mut origins = self.origins.lock().unwrap();
        if let Some(origin) = origins.get(&key) {
            return origin.clone();
        }
        let now = Instant::now();
        origins.retain(|_, v| Arc::strong_count(v) > 1 || *v.resume.lock().unwrap() > now);
        let origin = Arc::new(Origin {
            slots: Arc::new(Semaphore::new(ORIGIN_LIMIT)),
            resume: Mutex::new(now),
        });
        origins.insert(key, origin.clone());
        origin
    }

    pub(crate) fn get(&self, url: &str) -> Result<Request, DownloadError> {
        self.client.get(url).build().map_err(DownloadError::other)
    }

    pub(crate) async fn send(
        &self,
        initial: &Request,
        follow: bool,
        retry: &mut Attempts,
    ) -> Result<(Response, OriginPermit), DownloadError> {
        let mut request = initial.try_clone().expect("buffered request");
        let mut redirects = 0;
        loop {
            let origin = self.origin(request.url());
            let permit = origin
                .slots
                .clone()
                .acquire_owned()
                .await
                .expect("open origin");
            loop {
                let resume = *origin.resume.lock().unwrap();
                if resume <= Instant::now() {
                    break;
                }
                tokio::time::sleep_until(resume).await;
            }
            let result = self
                .client
                .execute(request.try_clone().expect("buffered request"))
                .await;
            let response = match result {
                Ok(response) => response,
                Err(e) if retry.available() && transient(&e) => {
                    drop(permit);
                    retry.backoff().await;
                    continue;
                }
                Err(e) => return Err(DownloadError::other(e.without_url())),
            };
            let status = response.status().as_u16();
            if status == 429 {
                let delay = cooldown(
                    response
                        .headers()
                        .get(header::RETRY_AFTER)
                        .and_then(|v| v.to_str().ok()),
                );
                let mut resume = origin.resume.lock().unwrap();
                *resume = (*resume).max(Instant::now() + delay);
            }
            if matches!(status, 429 | 502 | 503 | 504) && retry.available() {
                drop(response);
                drop(permit);
                retry.backoff().await;
                continue;
            }
            if follow && matches!(status, 301 | 302 | 303 | 307 | 308) {
                if let Some(location) = response.headers().get(header::LOCATION) {
                    let next = request
                        .url()
                        .join(location.to_str().map_err(DownloadError::other)?)
                        .map_err(DownloadError::other)?;
                    redirects += 1;
                    if redirects > 10 || !matches!(next.scheme(), "http" | "https") {
                        return Err(DownloadError::other("Invalid HTTP redirect"));
                    }
                    if next.origin() != request.url().origin() {
                        for name in [
                            header::AUTHORIZATION,
                            header::COOKIE,
                            header::PROXY_AUTHORIZATION,
                            header::HOST,
                        ] {
                            request.headers_mut().remove(name);
                        }
                    }
                    *request.url_mut() = next;
                    continue;
                }
            }
            return Ok((
                response,
                OriginPermit {
                    _slot: permit,
                    _origin: origin,
                },
            ));
        }
    }
}

// Hold the registry entry until the response body releases its origin slot.
pub(crate) struct OriginPermit {
    _slot: OwnedSemaphorePermit,
    _origin: Arc<Origin>,
}

fn cooldown(value: Option<&str>) -> Duration {
    let value = value.unwrap_or("").trim();
    if !value.is_empty() && value.bytes().all(|b| b.is_ascii_digit()) {
        return Duration::from_secs(value.parse().unwrap_or(u64::MAX)).min(MAX_COOLDOWN);
    }
    httpdate::parse_http_date(value)
        .map(|date| date.duration_since(SystemTime::now()).unwrap_or_default())
        .unwrap_or(Duration::from_secs(1))
        .min(MAX_COOLDOWN)
}

pub(crate) struct Attempts {
    left: usize,
}
impl Attempts {
    pub(crate) fn read() -> Self {
        Self {
            left: MAX_ATTEMPTS - 1,
        }
    }
    pub(crate) fn available(&self) -> bool {
        self.left > 0
    }
    pub(crate) async fn backoff(&mut self) {
        self.left -= 1;
        let bound = 100 << (MAX_ATTEMPTS - 2 - self.left);
        tokio::time::sleep(Duration::from_millis(fastrand::u64(bound..=2 * bound))).await;
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Document {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
}

async fn document(transport: Transport, doc: Document) -> Result<tauri::ipc::Response, String> {
    let method = Method::from_bytes(doc.method.as_bytes()).map_err(|e| e.to_string())?;
    let read = method == Method::GET || method == Method::HEAD;
    if !read && method != Method::POST {
        return Err("Unsupported HTTP method".into());
    }
    let mut builder = transport.client.request(method, &doc.url);
    for (key, value) in doc.headers {
        builder = builder.header(key, value);
    }
    if let Some(body) = doc.body {
        builder = builder.body(body);
    }
    let request = builder.build().map_err(|e| e.without_url().to_string())?;
    let mut retry = if read {
        Attempts::read()
    } else {
        Attempts { left: 0 }
    };
    loop {
        let (mut response, permit) = transport
            .send(&request, read, &mut retry)
            .await
            .map_err(DownloadError::install_message)?;
        let headers: Vec<_> = response
            .headers()
            .iter()
            .map(|(k, v)| (k.as_str(), String::from_utf8_lossy(v.as_bytes())))
            .collect();
        let mut bytes = serde_json::to_vec(&serde_json::json!({
            "status": response.status().as_u16(), "statusText": response.status().canonical_reason().unwrap_or(""),
            "headers": headers, "finalUrl": response.url().as_str()
        })).map_err(|e| e.to_string())?;
        bytes.push(b'\n');
        loop {
            match response.chunk().await {
                Ok(Some(chunk)) => bytes.extend_from_slice(&chunk),
                Ok(None) => return Ok(tauri::ipc::Response::new(bytes)),
                Err(e) if response.status().is_success() && retry.available() && transient(&e) => {
                    break
                }
                Err(e) => return Err(e.without_url().to_string()),
            }
        }
        drop(response);
        drop(permit);
        retry.backoff().await;
    }
}

pub(crate) fn fetch_document<R: tauri::Runtime>(
    invoke: &crate::Invoke<R>,
) -> Result<
    impl std::future::Future<Output = Result<tauri::ipc::Response, String>>,
    tauri::ipc::InvokeError,
> {
    const NAME: &str = "fetch_http_document";
    let transport = crate::argument::<tauri::State<Transport>, _>(invoke, NAME, "transport")?
        .inner()
        .clone();
    let doc = crate::argument(invoke, NAME, "request")?;
    let id: Option<String> = crate::argument(invoke, NAME, "cancelId")?;
    let flags: tauri::State<CancelFlags> = crate::argument(invoke, NAME, "flags")?;
    let registration = id.map(|id| flags.register(&id));
    Ok(async move {
        let work = document(transport, doc);
        match registration {
            None => work.await,
            Some(mut signal) => tokio::select! { biased;
                _ = signal.wait_for(|v| *v) => Err("Request cancelled".into()),
                result = work => result,
            },
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::downloads::{mock_http::accept_request, stream_file, supervise, CancelSignal};
    use tauri::ipc::{InvokeResponseBody, IpcResponse};
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpListener;

    fn doc(url: String, method: &str) -> Document {
        Document {
            url,
            method: method.into(),
            headers: vec![],
            body: None,
        }
    }

    #[test]
    fn delta_and_http_dates_are_bounded() {
        assert_eq!(cooldown(Some("999999999999999999999999")), MAX_COOLDOWN);
        assert_eq!(
            cooldown(Some("Sun, 06 Nov 1994 08:49:37 GMT")),
            Duration::ZERO
        );
        let date = httpdate::fmt_http_date(SystemTime::now() + Duration::from_secs(40));
        assert!((38..=40).contains(&cooldown(Some(&date)).as_secs()));
    }

    #[tokio::test]
    async fn completed_status_and_body_and_single_post_attempt() {
        for (method, status, body) in [
            ("POST", 503, "failed"),
            ("POST", 429, "slow"),
            ("GET", 404, "missing"),
            ("GET", 304, ""),
            ("GET", 204, ""),
        ] {
            let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
            let url = format!("http://{}/", listener.local_addr().unwrap());
            let origin = Transport::new().unwrap();
            let serve = async {
                let (mut stream, line) = accept_request(&listener).await;
                assert!(line.starts_with(method));
                stream
                    .write_all(
                        format!(
                            "HTTP/1.1 {status} test\r\nContent-Length: {}\r\n\r\n{body}",
                            body.len()
                        )
                        .as_bytes(),
                    )
                    .await
                    .unwrap();
            };
            let (reply, ()) = tokio::time::timeout(Duration::from_secs(3), async {
                tokio::join!(document(origin, doc(url.clone(), method)), serve)
            })
            .await
            .expect("a second attempt would stall");
            let InvokeResponseBody::Raw(bytes) = reply.unwrap().body().unwrap() else {
                panic!("expected binary document")
            };
            let end = bytes.iter().position(|&b| b == b'\n').unwrap();
            let metadata: serde_json::Value = serde_json::from_slice(&bytes[..end]).unwrap();
            assert_eq!(metadata["status"], status);
            assert_eq!(metadata["finalUrl"], url);
            assert_eq!(&bytes[end + 1..], body.as_bytes());
        }
    }

    #[tokio::test]
    async fn transient_statuses_share_a_bounded_attempt_budget() {
        use crate::downloads::mock_http::respond;
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let url = format!("http://{}/", listener.local_addr().unwrap());
        let serve = async {
            for status in [502, 503, 504] {
                let (socket, _) = accept_request(&listener).await;
                respond(
                    socket,
                    format!("HTTP/1.1 {status} gateway\r\nContent-Length: 0\r\n\r\n").as_bytes(),
                )
                .await;
            }
        };
        let (result, ()) = tokio::time::timeout(Duration::from_secs(5), async {
            tokio::join!(document(Transport::new().unwrap(), doc(url, "HEAD")), serve)
        })
        .await
        .unwrap();
        let InvokeResponseBody::Raw(bytes) = result.unwrap().body().unwrap() else {
            panic!("expected raw response")
        };
        let meta: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(meta["status"], 504);
    }

    #[tokio::test]
    async fn metadata_cooldown_paces_queued_artifacts_on_the_same_connection() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let root = tempfile::tempdir().unwrap();
        let transport = Transport::new().unwrap();
        let origin = transport.origin(&base.parse().unwrap());
        let _busy = origin
            .slots
            .clone()
            .acquire_many_owned((ORIGIN_LIMIT - 1) as u32)
            .await
            .unwrap();
        let meta = tokio::spawn(document(
            transport.clone(),
            doc(format!("{base}/meta"), "GET"),
        ));
        let (socket, line) = accept_request(&listener).await;
        assert!(line.starts_with("GET /meta "));
        let mut socket = BufReader::new(socket);
        let start = Instant::now();
        socket
            .get_mut()
            .write_all(b"HTTP/1.1 429 slow\r\nRetry-After: 1\r\nContent-Length: 0\r\n\r\n")
            .await
            .unwrap();
        let path = root.path().join("asset");
        let server = async {
            for _ in 0..2 {
                let mut line = String::new();
                socket.read_line(&mut line).await.unwrap();
                assert!(line.starts_with("GET /"));
                assert!(start.elapsed() >= Duration::from_secs(1));
                let mut headers = String::new();
                while !headers.ends_with("\r\n\r\n") {
                    assert_ne!(socket.read_line(&mut headers).await.unwrap(), 0);
                }
                assert!(headers.to_lowercase().contains("user-agent: kaede/"));
                socket
                    .get_mut()
                    .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok")
                    .await
                    .unwrap();
            }
        };
        let artifact = |path: std::path::PathBuf, signal: CancelSignal| {
            let transport = transport.clone();
            let url = format!("{base}/asset");
            async move {
                supervise(&signal, None, move |mut stop| async move {
                    stream_file(
                        &transport,
                        &url,
                        &path,
                        Some(2),
                        &[],
                        &Default::default(),
                        &mut stop,
                    )
                    .await
                })
                .await
                .unwrap()
            }
        };
        let (tx, signal) = CancelSignal::channel();
        let cancelled = root.path().join("cancelled");
        let (result, ()) = tokio::join!(artifact(cancelled.clone(), signal), async {
            while *origin.resume.lock().unwrap() <= start {
                tokio::task::yield_now().await;
            }
            tx.send_replace(true);
        });
        assert!(matches!(result, Err(DownloadError::Cancelled)));
        assert!(!cancelled.exists());
        let (_tx, signal) = CancelSignal::channel();
        tokio::time::timeout(Duration::from_secs(5), async {
            let ((), result, reply) = tokio::join!(server, artifact(path.clone(), signal), meta);
            result.unwrap();
            assert!(reply.unwrap().is_ok());
        })
        .await
        .unwrap();
        assert_eq!(std::fs::read(path).unwrap(), b"ok");
    }
}
