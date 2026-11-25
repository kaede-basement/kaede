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

const MAX_COOLDOWN: Duration = Duration::from_secs(15 * 60);
const COOLDOWN_WAIT_BUDGET: Duration = Duration::from_secs(60);
const MAX_DOCUMENT_BYTES: usize = 32 * 1024 * 1024;
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
            if matches!(
                io.kind(),
                ErrorKind::Interrupted
                    | ErrorKind::TimedOut
                    | ErrorKind::BrokenPipe
                    | ErrorKind::UnexpectedEof
                    | ErrorKind::ConnectionAborted
                    | ErrorKind::ConnectionReset
                    | ErrorKind::ConnectionRefused
            ) {
                return true;
            }
        }
        if error.downcast_ref::<h2::Error>().is_some_and(|e| {
            e.is_remote()
                && ((e.is_go_away() && e.reason() == Some(h2::Reason::NO_ERROR))
                    || (e.is_reset() && e.reason() == Some(h2::Reason::REFUSED_STREAM)))
        }) {
            return true;
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
                let wait = resume.saturating_duration_since(Instant::now());
                if wait.is_zero() {
                    break;
                }
                if wait > retry.cooldown_budget {
                    return Err(DownloadError::other(
                        "HTTP 429: origin cooldown exceeds request wait budget",
                    ));
                }
                retry.cooldown_budget -= wait;
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
            let retryable_status = if status == 429 {
                let delay = cooldown(
                    response
                        .headers()
                        .get(header::RETRY_AFTER)
                        .and_then(|v| v.to_str().ok()),
                );
                let mut resume = origin.resume.lock().unwrap();
                let now = Instant::now();
                *resume = (*resume).max(now + delay);
                *resume - now <= retry.cooldown_budget
            } else {
                matches!(status, 502..=504)
            };
            if retryable_status && retry.available() {
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
    cooldown_budget: Duration,
}
impl Attempts {
    pub(crate) fn read() -> Self {
        Self {
            left: MAX_ATTEMPTS - 1,
            cooldown_budget: COOLDOWN_WAIT_BUDGET,
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
#[serde(untagged)]
enum Body {
    Text(String),
    #[serde(skip_deserializing)]
    Binary(Vec<u8>),
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Document {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<Body>,
    follow_redirects: bool,
}

async fn document(
    transport: Transport,
    doc: Document,
    max_body_bytes: usize,
) -> Result<tauri::ipc::Response, String> {
    let method = Method::from_bytes(doc.method.as_bytes()).map_err(|e| e.to_string())?;
    let read = method == Method::GET || method == Method::HEAD;
    if !read && method != Method::POST {
        return Err("Unsupported HTTP method".into());
    }
    let mut builder = transport.client.request(method, &doc.url);
    for (key, value) in doc.headers {
        let bytes: Vec<u8> = value
            .chars()
            .map(|ch| u8::try_from(u32::from(ch)))
            .collect::<Result<_, _>>()
            .map_err(|_| "Invalid HTTP header ByteString")?;
        builder = builder.header(
            key,
            header::HeaderValue::from_bytes(&bytes).map_err(|e| e.to_string())?,
        );
    }
    if let Some(body) = doc.body {
        builder = builder.body(match body {
            Body::Text(text) => text.into_bytes(),
            Body::Binary(bytes) => bytes,
        });
    }
    let request = builder.build().map_err(|e| e.without_url().to_string())?;
    let mut retry = if read {
        Attempts::read()
    } else {
        Attempts {
            left: 0,
            ..Attempts::read()
        }
    };
    loop {
        let (mut response, permit) = transport
            .send(&request, read && doc.follow_redirects, &mut retry)
            .await
            .map_err(DownloadError::install_message)?;
        let headers: Vec<_> = response
            .headers()
            .iter()
            .map(|(k, v)| {
                (
                    k.as_str(),
                    v.as_bytes()
                        .iter()
                        .copied()
                        .map(char::from)
                        .collect::<String>(),
                )
            })
            .collect();
        let mut metadata = serde_json::json!({
            "status": response.status().as_u16(), "statusText": response.status().canonical_reason().unwrap_or(""),
            "headers": headers, "finalUrl": response.url().as_str()
        });
        let mut bytes = serde_json::to_vec(&metadata).map_err(|e| e.to_string())?;
        bytes.push(b'\n');
        let prefix_len = bytes.len();
        loop {
            let error = match response.chunk().await {
                Ok(Some(chunk)) if chunk.len() <= max_body_bytes - (bytes.len() - prefix_len) => {
                    bytes.extend_from_slice(&chunk);
                    continue;
                }
                Ok(Some(_)) => {
                    format!("HTTP document body exceeds the {max_body_bytes}-byte limit")
                }
                Ok(None) => return Ok(tauri::ipc::Response::new(bytes)),
                Err(e) if response.status().is_success() && retry.available() && transient(&e) => {
                    break
                }
                Err(e) => e.without_url().to_string(),
            };
            if response.status().is_success() {
                return Err(error);
            }
            metadata["bodyError"] = error.into();
            let mut frame = serde_json::to_vec(&metadata).map_err(|e| e.to_string())?;
            frame.push(b'\n');
            return Ok(tauri::ipc::Response::new(frame));
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
    let binary_envelope = |bytes: &[u8]| -> Result<_, String> {
        #[derive(serde::Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Envelope {
            request: Document,
            cancel_id: Option<String>,
        }
        let end = bytes
            .iter()
            .position(|&b| b == b'\n')
            .ok_or("Missing HTTP request metadata")?;
        let mut envelope: Envelope =
            serde_json::from_slice(&bytes[..end]).map_err(|e| e.to_string())?;
        envelope.request.body = Some(Body::Binary(bytes[end + 1..].to_vec()));
        Ok((envelope.request, envelope.cancel_id))
    };
    let (doc, id) = match invoke.message.payload() {
        tauri::ipc::InvokeBody::Raw(bytes) => binary_envelope(bytes)?,
        tauri::ipc::InvokeBody::Json(array @ serde_json::Value::Array(_)) => {
            use serde::Deserialize;
            let bytes = Vec::<u8>::deserialize(array).map_err(|e| e.to_string())?;
            binary_envelope(&bytes)?
        }
        _ => (
            crate::argument(invoke, NAME, "request")?,
            crate::argument::<Option<String>, _>(invoke, NAME, "cancelId")?,
        ),
    };
    let flags: tauri::State<CancelFlags> = crate::argument(invoke, NAME, "flags")?;
    let registration = id.map(|id| flags.register(&id));
    Ok(async move {
        let work = document(transport, doc, MAX_DOCUMENT_BYTES);
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
            follow_redirects: true,
        }
    }

    #[tokio::test]
    async fn header_octets_round_trip_and_interrupted_error_body_keeps_status() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let transport = Transport::new().unwrap();
        let url = format!("http://{}/", listener.local_addr().unwrap());
        let server = async {
            let (socket, _) = accept_request(&listener).await;
            crate::downloads::mock_http::respond(socket,b"HTTP/1.1 200 OK\r\nETag: \"\xe9\"\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
            let (socket, _) = listener.accept().await.unwrap();
            let mut reader = BufReader::new(socket);
            let mut headers = Vec::new();
            while !headers.ends_with(b"\r\n\r\n") {
                assert_ne!(reader.read_until(b'\n', &mut headers).await.unwrap(), 0);
            }
            headers.make_ascii_lowercase();
            let tag = b"if-none-match: \"\xe9\"\r\n";
            assert!(headers.windows(tag.len()).any(|h| h == tag));
            crate::downloads::mock_http::respond(
                reader.into_inner(),
                b"HTTP/1.1 404 Not Found\r\nContent-Length: 100\r\n\r\npartial",
            )
            .await;
        };
        let requests = async {
            let mut request = doc(url.clone(), "GET");
            for status in [200, 404] {
                let reply = document(transport.clone(), request, MAX_DOCUMENT_BYTES)
                    .await
                    .unwrap();
                let InvokeResponseBody::Raw(bytes) = reply.body().unwrap() else {
                    panic!("expected document")
                };
                let end = bytes.iter().position(|&b| b == b'\n').unwrap();
                let meta: serde_json::Value = serde_json::from_slice(&bytes[..end]).unwrap();
                assert_eq!(meta["status"], status);
                request = doc(url.clone(), "GET");
                if status == 200 {
                    let tag = meta["headers"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .find(|h| h[0] == "etag")
                        .unwrap()[1]
                        .as_str()
                        .unwrap();
                    assert_eq!(tag, "\"é\"");
                    request.headers.push(("if-none-match".into(), tag.into()));
                    assert!(meta["bodyError"].is_null());
                } else {
                    assert!(!meta["bodyError"].as_str().unwrap().is_empty());
                    assert!(bytes[end + 1..].is_empty());
                }
            }
        };
        tokio::time::timeout(Duration::from_secs(5), async {
            tokio::join!(server, requests)
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn oversized_chunked_document_releases_its_origin_slot() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let url = format!("http://{}/", listener.local_addr().unwrap());
        let transport = Transport::new().unwrap();
        let origin = transport.origin(&url.parse().unwrap());
        tokio::time::timeout(Duration::from_secs(5), async {
            let fetch = tokio::spawn(document(transport, doc(url, "GET"), 5));
            let (mut socket, _) = accept_request(&listener).await;
            socket.write_all(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n3\r\ndef\r\n").await.unwrap();
            // Keep the response open: the reader must reject before EOF.
            let reply = fetch.await.unwrap();
            assert!(reply.err().unwrap().contains("5-byte limit"));
        }).await.unwrap();
        assert_eq!(origin.slots.available_permits(), ORIGIN_LIMIT);
    }

    #[tokio::test]
    async fn long_retry_after_returns_429_and_keeps_the_origin_paused() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let url = format!("http://{}/", listener.local_addr().unwrap());
        let transport = Transport::new().unwrap();
        let serve = async {
            let (socket, _) = accept_request(&listener).await;
            crate::downloads::mock_http::respond(
                socket,
                b"HTTP/1.1 429 slow\r\nRetry-After: 600\r\nContent-Length: 0\r\n\r\n",
            )
            .await;
        };
        tokio::time::timeout(Duration::from_secs(5), async {
            let (reply, ()) = tokio::join!(
                document(
                    transport.clone(),
                    doc(url.clone(), "GET"),
                    MAX_DOCUMENT_BYTES
                ),
                serve
            );
            let InvokeResponseBody::Raw(bytes) = reply.unwrap().body().unwrap() else {
                panic!("expected document")
            };
            let meta: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
            assert_eq!(meta["status"], 429);
            let origin = transport.origin(&url.parse().unwrap());
            let resume = *origin.resume.lock().unwrap();
            assert!(resume > Instant::now() + Duration::from_secs(590));
            let blocked = document(transport, doc(url, "GET"), MAX_DOCUMENT_BYTES).await;
            assert!(blocked.err().unwrap().contains("429"));
            assert_eq!(*origin.resume.lock().unwrap(), resume);
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn refused_stream_and_graceful_goaway_retry_only_reads() {
        for method in ["GET", "POST"] {
            for goaway in [false, true] {
                let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
                let url = format!("http://{}/", listener.local_addr().unwrap());
                let transport = Transport {
                    client: Client::builder()
                        .no_proxy()
                        .http2_prior_knowledge()
                        .retry(reqwest::retry::never())
                        .build()
                        .unwrap(),
                    origins: Default::default(),
                };
                let server = async {
                    let (socket, _) = listener.accept().await.unwrap();
                    let mut conn = h2::server::handshake(socket).await.unwrap();
                    let (_request, mut response) = conn.accept().await.unwrap().unwrap();
                    if goaway {
                        conn.abrupt_shutdown(h2::Reason::NO_ERROR);
                    } else {
                        response.send_reset(h2::Reason::REFUSED_STREAM);
                        conn.graceful_shutdown();
                    }
                    drop(response);
                    let _ = std::future::poll_fn(|cx| conn.poll_closed(cx)).await;
                    if method == "GET" {
                        let (socket, _) = listener.accept().await.unwrap();
                        let mut conn = h2::server::handshake(socket).await.unwrap();
                        let (_, mut response) = conn.accept().await.unwrap().unwrap();
                        response
                            .send_response(tauri::http::Response::new(()), true)
                            .unwrap();
                        conn.graceful_shutdown();
                        let _ = std::future::poll_fn(|cx| conn.poll_closed(cx)).await;
                    }
                };
                let (result, ()) = tokio::time::timeout(Duration::from_secs(5), async {
                    tokio::join!(
                        document(transport, doc(url, method), MAX_DOCUMENT_BYTES),
                        server
                    )
                })
                .await
                .unwrap();
                assert_eq!(result.is_ok(), method == "GET");
            }
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
                tokio::join!(
                    document(origin, doc(url.clone(), method), MAX_DOCUMENT_BYTES),
                    serve
                )
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
            tokio::join!(
                document(
                    Transport::new().unwrap(),
                    doc(url, "HEAD"),
                    MAX_DOCUMENT_BYTES
                ),
                serve
            )
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
            MAX_DOCUMENT_BYTES,
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
            tokio::time::timeout(Duration::from_secs(5), async {
                while *origin.resume.lock().unwrap() <= start {
                    tokio::task::yield_now().await;
                }
            })
            .await
            .expect("metadata request should set the origin cooldown");
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
