//!
//! ATTENTION: AI-generated (by Claude Opus 5.5)
//!
//! Rust side of the batching in hybrid_ipc.js: `ipc_batch` receives the calls one page made in the
//! same tick and hands each to `Webview::on_message`, the path every invoke takes, so the invoke key
//! and the ACL are checked per call. It must stay an app command: Tauri holds its plugin lock while
//! a plugin command runs, and a nested plugin call would wait on it forever. `ipc_batch_take` must
//! be registered next to it.

use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, HashMap};
use std::sync::{Mutex, OnceLock};
use std::sync::atomic::{AtomicU64, Ordering};

use tauri::http::header::{CONTENT_TYPE, ORIGIN};
use tauri::http::{HeaderMap, HeaderName, HeaderValue};
use tauri::ipc::{CallbackFn, InvokeBody, InvokeResponse, InvokeResponseBody};
use tauri::webview::InvokeRequest;
use tauri::{AppHandle, Manager, Webview};

/// Tauri's own limit for delivering a JSON response with eval rather than a fetch (ipc/channel.rs).
const MAX_EVAL_JSON_BYTES: usize = 8192;
/// The same for binary responses.
const MAX_EVAL_RAW_BYTES: usize = 1024;

/// Responses waiting for the next delivery, per page load (a random id hybrid_ipc.js draws, so a
/// window recreated under the same label never receives the old one's responses): `[callback,
/// value, kind]` as JSON, delivered together by one eval that parses them with JSON.parse, which
/// keeps a `__proto__` key an own property as `response.json()` does on the default transport.
/// `kind`: 0 JSON, 1 bytes as numbers, 2 the number of a response in `LARGE`.
static PENDING: Mutex<BTreeMap<String, Pending>> = Mutex::new(BTreeMap::new());

#[derive(Default)]
struct Pending {
    items: Vec<String>,
    /// The webviews the responders were handed, kept for `deliver` to evaluate in and drop on the
    /// main thread: on Linux a `Webview` holds tao's non-atomic `Rc`, so cloning or dropping one
    /// on another thread races with the main thread.
    webviews: Vec<Webview>,
}

/// Schedules deliveries from any thread without touching a `Webview` there; set on the main
/// thread by the first `ipc_batch`.
static APP: OnceLock<AppHandle> = OnceLock::new();

/// Responses too large for eval, kept until the page asking for them takes them with
/// `ipc_batch_take` over the custom protocol, so they reach it as a fetch response, as on the
/// default transport.
static LARGE: Mutex<LargeStore> = Mutex::new(LargeStore { responses: BTreeMap::new(), pages: BTreeMap::new() });
static NEXT_LARGE: AtomicU64 = AtomicU64::new(0);

struct LargeStore {
    /// By number.
    responses: BTreeMap<u64, Large>,
    /// The page each live webview last sent a batch from: a response for any other page, or for a
    /// webview whose window was destroyed, has no one left to take it.
    pages: BTreeMap<String, String>,
}

struct Large {
    page: String,
    label: String,
    body: InvokeResponseBody,
}

impl LargeStore {
    /// Records that the webview now holds `page`, dropping what its earlier pages left.
    fn page_loaded(&mut self, webview: &Webview, page: &str) {
        let label = webview.label().to_owned();
        if self.pages.insert(label.clone(), page.to_owned()).is_none() {
            webview.window().on_window_event(move |event| {
                if let tauri::WindowEvent::Destroyed = event {
                    let mut store = LARGE.lock().unwrap();
                    store.pages.remove(&label);
                    store.responses.retain(|_, large| large.label != label);
                }
            });
        }
        self.responses.retain(|_, large| large.label != webview.label() || large.page == page);
    }

    /// Keeps a response if its page is still the one its webview holds.
    fn insert(&mut self, webview: &Webview, page: &str, body: InvokeResponseBody) -> Option<u64> {
        if self.pages.get(webview.label()).map(String::as_str) != Some(page) {
            return None;
        }
        let id = NEXT_LARGE.fetch_add(1, Ordering::Relaxed);
        let large = Large { page: page.to_owned(), label: webview.label().to_owned(), body };
        self.responses.insert(id, large);
        Some(id)
    }
}

thread_local! {
    /// Set while `ipc_batch` dispatches: synchronous commands respond inside that loop, on the
    /// main thread, where `run_on_main_thread` runs at once instead of queueing.
    static DISPATCHING: Cell<bool> = const { Cell::new(false) };
    /// The pages, of any webview, that got their first pending response during that loop: it
    /// delivers to each of them when it ends.
    static DEFERRED: RefCell<Vec<String>> = const { RefCell::new(Vec::new()) };
}

/// Marks this thread as dispatching until dropped, on a panic too.
struct Dispatching;

impl Dispatching {
    fn start() -> Self {
        DISPATCHING.set(true);
        Self
    }
}

impl Drop for Dispatching {
    fn drop(&mut self) {
        DISPATCHING.set(false);
    }
}

#[derive(serde::Deserialize)]
pub struct Call {
    cmd: String,
    callback: CallbackFn,
    error: CallbackFn,
    /// The payload as JSON text, parsed per call as the custom protocol parses a request body, so
    /// a payload it rejects (too deep, a lone surrogate) rejects this call alone.
    payload: String,
    /// The payload is the bytes of a binary argument, as a JSON array of numbers.
    bin: bool,
    headers: HashMap<String, String>,
}

#[tauri::command]
pub fn ipc_batch(webview: Webview, page: String, calls: Vec<Call>, blocked: bool) -> Result<(), String> {
    let page_url = webview.url().map_err(|e| e.to_string())?;
    // The transport a call replaces decides the URL its ACL check sees: the custom protocol's is
    // the Origin header, Tauri's postMessage fallback's is the page's whole URL.
    let (acl_url, origin_header) = match origin(&page_url) {
        Ok(origin) if !blocked => (origin.url, Some(origin.header)),
        Err(e) if !blocked => return Err(e),
        origin => (page_url, origin.ok().map(|origin| origin.header)),
    };
    let invoke_key = webview.app_handle().invoke_key().to_owned();
    let invoke_key_header = HeaderValue::from_str(&invoke_key).map_err(|e| e.to_string())?;
    APP.get_or_init(|| webview.app_handle().clone());
    LARGE.lock().unwrap().page_loaded(&webview, &page);
    let dispatching = Dispatching::start();
    for call in calls {
        let error = call.error;
        match request(call, &acl_url, origin_header.as_ref(), &invoke_key, &invoke_key_header) {
            Ok(request) => {
                let page = page.clone();
                webview.clone().on_message(
                    request,
                    Box::new(move |webview, _cmd, response, callback, error| {
                        respond(webview, &page, response, callback, error, blocked)
                    }),
                );
            }
            Err(e) => queue(webview.clone(), &page, error_item(error, &e)),
        }
    }
    drop(dispatching);
    for page in DEFERRED.take() {
        deliver(&page);
    }
    Ok(())
}

/// The Origin header the page's fetch would send, and the URL Tauri's custom protocol parses
/// from it to check the ACL: scheme, host and port, not the path. `Url::origin` is no use here:
/// it calls the `tauri:` scheme of bundled pages on Linux opaque, which a fetch sends as
/// `tauri://localhost`.
struct Origin {
    header: HeaderValue,
    url: tauri::Url,
}

fn origin(page: &tauri::Url) -> Result<Origin, String> {
    // A page without a host (data:, file:) sends `Origin: null`, which the custom protocol rejects.
    let host = page.host_str().ok_or("Origin header is not a valid URL")?;
    let port = page.port().map(|port| format!(":{port}")).unwrap_or_default();
    let text = format!("{}://{host}{port}", page.scheme());
    let url = tauri::Url::parse(&text).map_err(|_| "Origin header is not a valid URL")?;
    let header = HeaderValue::from_str(&text).map_err(|e| e.to_string())?;
    Ok(Origin { header, url })
}

const TAURI_CALLBACK: HeaderName = HeaderName::from_static("tauri-callback");
const TAURI_ERROR: HeaderName = HeaderName::from_static("tauri-error");
const TAURI_INVOKE_KEY: HeaderName = HeaderName::from_static("tauri-invoke-key");

fn request(
    call: Call,
    acl_url: &tauri::Url,
    origin_header: Option<&HeaderValue>,
    invoke_key: &str,
    invoke_key_header: &HeaderValue,
) -> Result<InvokeRequest, String> {
    let mut headers = HeaderMap::new();
    for (name, value) in &call.headers {
        let header_name = HeaderName::from_bytes(name.as_bytes()).map_err(|e| format!("header {name}: {e}"))?;
        // The webview hands a fetch's header values to Rust as strings; Tauri keeps their UTF-8.
        let value = HeaderValue::from_bytes(value.as_bytes()).map_err(|e| format!("header {name}: {e}"))?;
        headers.insert(header_name, value);
    }
    // The headers hybrid_ipc.js's fetch path sets over the caller's.
    let content_type = if call.bin { "application/octet-stream" } else { "application/json" };
    headers.insert(CONTENT_TYPE, HeaderValue::from_static(content_type));
    headers.insert(TAURI_CALLBACK, HeaderValue::from(call.callback.0));
    headers.insert(TAURI_ERROR, HeaderValue::from(call.error.0));
    headers.insert(TAURI_INVOKE_KEY, invoke_key_header.clone());
    if let Some(origin) = origin_header {
        headers.insert(ORIGIN, origin.clone());
    }
    let body = if call.bin {
        InvokeBody::Raw(serde_json::from_str(&call.payload).map_err(|e| e.to_string())?)
    } else {
        InvokeBody::Json(serde_json::from_str(&call.payload).map_err(|e| e.to_string())?)
    };
    Ok(InvokeRequest {
        cmd: call.cmd,
        callback: call.callback,
        error: call.error,
        url: acl_url.clone(),
        body,
        headers,
        invoke_key: invoke_key.to_owned(),
    })
}

/// Hands a large response to the page that `ipc_batch` delivered its number to.
#[tauri::command]
pub fn ipc_batch_take(webview: Webview, page: String, id: u64) -> Result<InvokeResponseBody, String> {
    let mut store = LARGE.lock().unwrap();
    match store.responses.get(&id) {
        Some(entry) if entry.page == page && entry.label == webview.label() => {
            Ok(store.responses.remove(&id).expect("the entry is there").body)
        }
        _ => Err(format!("ipc_batch_take: no response {id} for this page")),
    }
}

fn error_item(error: CallbackFn, message: &str) -> String {
    format!("[{},{},0]", error.0, serde_json::Value::String(message.to_owned()))
}

/// `blocked`: the page's custom protocol failed, so it cannot take a large response with a fetch;
/// every response then goes through eval.
fn respond(webview: Webview, page: &str, response: InvokeResponse, callback: CallbackFn, error: CallbackFn, blocked: bool) {
    let item = match response {
        InvokeResponse::Ok(InvokeResponseBody::Json(json)) if blocked || json.len() < MAX_EVAL_JSON_BYTES => {
            format!("[{},{json},0]", callback.0)
        }
        InvokeResponse::Ok(InvokeResponseBody::Raw(bytes)) if blocked || bytes.len() < MAX_EVAL_RAW_BYTES => {
            let numbers = serde_json::to_string(&bytes).expect("bytes serialize");
            format!("[{},{numbers},1]", callback.0)
        }
        InvokeResponse::Ok(body) => match LARGE.lock().unwrap().insert(&webview, page, body) {
            // The page takes it with this call's own callbacks.
            Some(id) => format!("[[{},{}],{id},2]", callback.0, error.0),
            // The page that asked is gone, and so is the callback this would go to. A task the
            // closed event loop rejects is dropped on this thread: it then leaks the webview.
            None => {
                let webview = std::mem::ManuallyDrop::new(webview);
                on_main_thread(move || drop(std::mem::ManuallyDrop::into_inner(webview)));
                return;
            }
        },
        InvokeResponse::Err(e) => format!("[{},{},0]", error.0, e.0),
    };
    queue(webview, page, item);
}

/// Called on any thread, with the webview the responder was handed.
fn queue(webview: Webview, page: &str, item: String) {
    let first = {
        let mut pending = PENDING.lock().unwrap();
        let entry = pending.entry(page.to_owned()).or_default();
        entry.items.push(item);
        entry.webviews.push(webview);
        entry.items.len() == 1
    };
    if first && DISPATCHING.get() {
        DEFERRED.with_borrow_mut(|deferred| deferred.push(page.to_owned()));
    } else if first {
        // Queued behind the work already on the main thread, so responses that complete
        // meanwhile share one eval.
        let owned = page.to_owned();
        if !on_main_thread(move || deliver(&owned)) {
            discard(page);
        }
    }
}

/// The event loop is gone, so nothing will deliver the page's responses: their text is freed, and
/// the webviews leak rather than drop off the main thread.
fn discard(page: &str) {
    if let Some(Pending { webviews, .. }) = PENDING.lock().unwrap().remove(page) {
        std::mem::forget(webviews);
    }
}

/// False when the event loop rejected the task, which it then drops on this thread.
fn on_main_thread(task: impl FnOnce() + Send + 'static) -> bool {
    let app = APP.get().expect("ipc_batch ran before any response");
    match app.run_on_main_thread(task) {
        Ok(()) => true,
        Err(e) => {
            log::error!("ipc_batch: cannot run on the main thread: {e}");
            false
        }
    }
}

/// Runs on the main thread.
fn deliver(page: &str) {
    let Some(Pending { items, webviews }) = PENDING.lock().unwrap().remove(page) else {
        return;
    };
    let json = format!("[{}]", items.join(","));
    let literal = serde_json::to_string(&json).expect("a string serializes");
    let page = serde_json::to_string(page).expect("a string serializes");
    // The check comes before the responses are parsed, so another document never sees them.
    let script = format!(
        "(() => {{ const i = window.__TAURI_INTERNALS__; if (i.ipcPage === {page}) i.ipcBatchDeliver(JSON.parse({literal})) }})()"
    );
    if let Err(e) = webviews[0].eval(script) {
        log::error!("ipc_batch: cannot deliver {} responses: {e}", items.len());
    }
}
