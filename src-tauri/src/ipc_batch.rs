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
use std::fmt;
use std::sync::{Arc, Mutex, OnceLock, RwLock, Weak};
use std::sync::atomic::{AtomicU64, Ordering};

use tauri::http::header::{CONTENT_TYPE, ORIGIN};
use tauri::http::{HeaderMap, HeaderName, HeaderValue};
use tauri::ipc::{CallbackFn, InvokeBody, InvokeResponse, InvokeResponseBody};
use tauri::webview::InvokeRequest;
use tauri::{AppHandle, Listener, Manager, Webview};

/// Tauri's own limit for delivering a JSON response with eval rather than a fetch (ipc/channel.rs).
const MAX_EVAL_JSON_BYTES: usize = 8192;
/// The same for binary responses.
const MAX_EVAL_RAW_BYTES: usize = 1024;

/// Responses waiting for the next delivery, per page load (a random id hybrid_ipc.js draws, so a
/// window recreated under the same label never receives the old one's responses): `[callback,
/// value, kind]` as JSON, delivered together by one eval that parses them with JSON.parse, which
/// keeps a `__proto__` key an own property as `response.json()` does on the default transport.
/// `kind`: 0 JSON, 1 bytes as numbers, 2 the number of a response in `LARGE`.
static PENDING: Mutex<BTreeMap<tauri::EventId, Pending>> = Mutex::new(BTreeMap::new());

#[derive(Default)]
struct Pending {
    items: Vec<String>,
    large: Vec<(u64, InvokeResponseBody)>,
    /// The webviews the responders were handed, kept for `deliver` to evaluate in and drop on the
    /// main thread: on Linux a `Webview` holds tao's non-atomic `Rc`, so cloning or dropping one
    /// on another thread races with the main thread.
    webviews: Vec<Webview>,
}

impl Pending {
    fn push_item(&mut self, page: &Page, item: String, large: Option<(u64, InvokeResponseBody)>) {
        if large.is_some() && !page.is_open() {
            return;
        }
        self.items.push(item);
        self.large.extend(large);
    }
}

/// Schedules deliveries from any thread without touching a `Webview` there; set on the main
/// thread by the first `ipc_batch`.
static TRANSPORT: OnceLock<Transport> = OnceLock::new();

struct Transport {
    app: AppHandle,
    invoke_key_header: HeaderValue,
}

impl Transport {
    // Synchronous app commands on this transport run on the webview thread.
    fn initialize(app: &AppHandle) -> Result<&'static Self, String> {
        if let Some(transport) = TRANSPORT.get() {
            return Ok(transport);
        }
        let invoke_key_header = HeaderValue::from_str(app.invoke_key()).map_err(|e| e.to_string())?;
        Ok(TRANSPORT.get_or_init(|| Self { app: app.clone(), invoke_key_header }))
    }
}

/// Responses too large for eval, kept until the page asking for them takes them with
/// `ipc_batch_take` over the custom protocol, so they reach it as a fetch response, as on the
/// default transport.
static LARGE: RwLock<LargeStore> = RwLock::new(LargeStore { pages: BTreeMap::new() });
static NEXT_LARGE: AtomicU64 = AtomicU64::new(0);

type Responses = Mutex<Option<BTreeMap<u64, InvokeResponseBody>>>;

struct Page {
    id: String,
    listener: tauri::EventId,
    window_label: String,
    responses: Weak<Responses>,
}

impl Page {
    fn is_open(&self) -> bool {
        self.responses.upgrade().is_some_and(|responses| responses.lock().unwrap().is_some())
    }

    fn close(&self) {
        if let Some(responses) = self.responses.upgrade() {
            *responses.lock().unwrap() = None;
        }
        if let Some(pending) = PENDING.lock().unwrap().get_mut(&self.listener) {
            pending.large.clear();
            pending.items.clear();
            // The scheduled delivery still owns the main-thread webview drops.
        }
    }

    fn publish(&self, large: Vec<(u64, InvokeResponseBody)>) -> bool {
        let Some(responses) = self.responses.upgrade() else { return false };
        let mut bucket = responses.lock().unwrap();
        let Some(entries) = bucket.as_mut() else { return false };
        entries.extend(large);
        true
    }
}

struct LargeStore {
    pages: BTreeMap<String, Arc<Page>>,
}

impl LargeStore {
    fn current(&self, label: &str, page: &str) -> Option<&Arc<Page>> {
        self.pages.get(label).filter(|entry| entry.id == page && entry.responses.strong_count() != 0)
    }

    fn prune_closed(&mut self) {
        self.pages.retain(|_, page| page.responses.strong_count() != 0);
    }

    fn invalidate(&mut self, label: &str) -> Option<tauri::EventId> {
        let page = self.pages.remove(label)?;
        page.close();
        Some(page.listener)
    }

    fn close_window(&mut self, window_label: &str) {
        self.pages.retain(|_, page| {
            if page.window_label == window_label {
                page.close();
                return false;
            }
            page.responses.strong_count() != 0
        });
    }

    fn take(&self, label: &str, page: &str, id: u64) -> Result<InvokeResponseBody, String> {
        self.current(label, page)
            .and_then(|entry| entry.responses.upgrade())
            .and_then(|responses| responses.lock().unwrap().as_mut()?.remove(&id))
            .ok_or_else(|| format!("ipc_batch_take: no response {id} for this page"))
    }
}

pub fn page_left(webview: &Webview) {
    let listener = LARGE.write().unwrap().invalidate(webview.label());
    if let Some(listener) = listener {
        webview.unlisten(listener);
    }
}

pub fn window_destroyed(window_label: &str) {
    LARGE.write().unwrap().close_window(window_label);
}

// Window::webviews reads the manager registry and clones handles, so call it on the main thread.
fn is_registered(webview: &Webview) -> bool {
    webview.window().webviews().iter().any(|live| live.label() == webview.label())
}

fn page_loaded(webview: &Webview, page: String) -> Result<Arc<Page>, String> {
    if let Some(current) = LARGE.read().unwrap().current(webview.label(), &page) {
        return Ok(current.clone());
    }
    page_left(webview);
    let responses = Arc::new(Responses::new(Some(BTreeMap::new())));
    let weak = Arc::downgrade(&responses);
    // Tauri removes webview-scoped Rust listeners on both independent webview close
    // and parent window destruction. The listener owns the bodies until then or navigation.
    let listener = webview.listen("tauri://destroyed", move |_| { let _ = &responses; });
    if !is_registered(webview) {
        webview.unlisten(listener);
        return Err("ipc_batch: webview closed before admission".into());
    }
    let mut store = LARGE.write().unwrap();
    store.prune_closed();
    let current = Arc::new(Page {
        id: page,
        listener,
        window_label: webview.window_ref().label().to_owned(),
        responses: weak,
    });
    store.pages.insert(webview.label().to_owned(), current.clone());
    Ok(current)
}

thread_local! {
    /// Set while `ipc_batch` dispatches: synchronous commands respond inside that loop, on the
    /// main thread, where `run_on_main_thread` runs at once instead of queueing.
    static DISPATCHING: Cell<bool> = const { Cell::new(false) };
    /// The pages, of any webview, that got their first pending response during that loop: it
    /// delivers to each of them when it ends.
    static DEFERRED: RefCell<Vec<Box<dyn FnOnce()>>> = const { RefCell::new(Vec::new()) };
}

/// Marks this thread as dispatching until dropped, on a panic too.
pub(super) struct Dispatching(bool);

impl Dispatching {
    pub(super) fn start() -> Self {
        Self(DISPATCHING.replace(true))
    }
}

impl Drop for Dispatching {
    fn drop(&mut self) {
        DISPATCHING.set(self.0);
        if !self.0 {
            for flush in DEFERRED.take() {
                flush();
            }
        }
    }
}

#[derive(serde::Deserialize)]
pub struct Call {
    cmd: String,
    callback: CallbackFn,
    error: CallbackFn,
    /// The payload as JSON text, parsed per call as the custom protocol parses a request body, so
    /// a payload it rejects (too deep, a lone surrogate) rejects this call alone. Omitted for {}.
    payload: Option<String>,
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
    let app = webview.app_handle();
    let transport = Transport::initialize(app)?;
    let page = page_loaded(&webview, page)?;
    let _dispatching = Dispatching::start();
    for call in calls {
        let error = call.error;
        match request(call, &acl_url, origin_header.as_ref(), app.invoke_key(), &transport.invoke_key_header) {
            Ok(request) => {
                let page = page.clone();
                webview.clone().on_message(
                    request,
                    Box::new(move |webview, _cmd, response, callback, error| {
                        respond(webview, &page, response, callback, error, blocked)
                    }),
                );
            }
            Err(e) => queue(webview.clone(), &page, error_item(error, &e), None),
        }
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
    let payload = call.payload.as_deref().unwrap_or("{}");
    let body = if call.bin {
        InvokeBody::Raw(serde_json::from_str(payload).map_err(|e| e.to_string())?)
    } else {
        InvokeBody::Json(serde_json::from_str(payload).map_err(|e| e.to_string())?)
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
    LARGE.read().unwrap().take(webview.label(), &page, id)
}

fn error_item(error: CallbackFn, message: &str) -> String {
    format!("[{},{},0]", error.0, serde_json::Value::String(message.to_owned()))
}

/// `blocked`: the page's custom protocol failed, so it cannot take a large response with a fetch;
/// every response then goes through eval.
fn respond(webview: Webview, page: &Arc<Page>, response: InvokeResponse, callback: CallbackFn, error: CallbackFn, blocked: bool) {
    let item = match response {
        InvokeResponse::Ok(InvokeResponseBody::Json(json)) if blocked || json.len() < MAX_EVAL_JSON_BYTES => {
            format!("[{},{json},0]", callback.0)
        }
        InvokeResponse::Ok(InvokeResponseBody::Raw(bytes)) if blocked || bytes.len() < MAX_EVAL_RAW_BYTES => {
            let numbers = serde_json::to_string(&bytes).expect("bytes serialize");
            format!("[{},{numbers},1]", callback.0)
        }
        InvokeResponse::Ok(body) => {
            let id = NEXT_LARGE.fetch_add(1, Ordering::Relaxed);
            let item = format!("[[{},{}],{id},2]", callback.0, error.0);
            queue(webview, page, item, Some((id, body)));
            return;
        }
        InvokeResponse::Err(e) => format!("[{},{},0]", error.0, e.0),
    };
    queue(webview, page, item, None);
}

/// Called on any thread, with the webview the responder was handed.
fn queue(webview: Webview, page: &Arc<Page>, item: String, large: Option<(u64, InvokeResponseBody)>) {
    enqueue(page, |entry| {
        entry.push_item(page, item, large);
        entry.webviews.push(webview);
    }, deliver);
}

fn enqueue(page: &Arc<Page>, append: impl FnOnce(&mut Pending), flush: impl FnOnce(&Page) + Send + 'static) {
    use std::collections::btree_map::Entry;
    let mut pending = PENDING.lock().unwrap();
    let entry = match pending.entry(page.listener) {
        Entry::Occupied(mut entry) => {
            append(entry.get_mut());
            return;
        }
        Entry::Vacant(entry) => entry.insert(Pending::default()),
    };
    append(entry);
    drop(pending);
    let owned = page.clone();
    let delivery = move || flush(&owned);
    if DISPATCHING.get() {
        DEFERRED.with_borrow_mut(|deferred| deferred.push(Box::new(delivery)));
    } else if !on_main_thread(delivery) {
        discard(page);
    }
}

/// The event loop is gone, so nothing will deliver the page's responses: their text is freed, and
/// the webviews leak rather than drop off the main thread.
fn discard(page: &Page) {
    if let Some(Pending { webviews, .. }) = PENDING.lock().unwrap().remove(&page.listener) {
        std::mem::forget(webviews);
    }
}

/// False when the event loop rejected the task, which it then drops on this thread.
fn on_main_thread(task: impl FnOnce() + Send + 'static) -> bool {
    let app = &TRANSPORT.get().expect("ipc_batch ran before any response").app;
    match app.run_on_main_thread(task) {
        Ok(()) => true,
        Err(e) => {
            log::error!("ipc_batch: cannot run on the main thread: {e}");
            false
        }
    }
}

/// Runs on the main thread.
fn deliver(page: &Page) {
    let Some(Pending { items, large, webviews }) = PENDING.lock().unwrap().remove(&page.listener) else {
        return;
    };
    if items.is_empty() {
        return;
    }
    if !large.is_empty() {
        let webview = &webviews[0];
        if !is_registered(webview) {
            // A replacement webview with the same label can already own another page.
            let current = LARGE.read().unwrap().pages.get(webview.label())
                .is_some_and(|current| current.listener == page.listener);
            if current {
                page_left(webview);
            }
            return;
        }
        if !page.publish(large) {
            return;
        }
    }
    let script = delivery_script(&page.id, &items);
    if let Err(e) = webviews[0].eval(script) {
        log::error!("ipc_batch: cannot deliver {} responses: {e}", items.len());
    }
}

/// Stream the inner array through serde_json's string escaper into the final script.
fn delivery_script(page: &str, items: &[String]) -> String {
    struct Items<'a>(&'a [String]);
    impl fmt::Display for Items<'_> {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str("[")?;
            for (i, item) in self.0.iter().enumerate() {
                if i > 0 {
                    f.write_str(",")?;
                }
                f.write_str(item)?;
            }
            f.write_str("]")
        }
    }

    const PREFIX: &[u8] = b"(() => { const i = window.__TAURI_INTERNALS__; if (i.ipcPage === ";
    const PARSE: &[u8] = b") i.ipcBatchDeliver(JSON.parse(";
    const END: &[u8] = b")) })()";
    // A valid JSON item's quotes, backslashes and whitespace each expand by at most
    // one byte. Other control characters can occur in the untrusted page identifier.
    let size = 2 * items.iter().map(String::len).sum::<usize>() + items.len() + 6 * page.len();
    let mut script = Vec::with_capacity(PREFIX.len() + PARSE.len() + END.len() + size + 6);
    script.extend_from_slice(PREFIX);
    serde_json::to_writer(&mut script, page).expect("a string serializes");
    script.extend_from_slice(PARSE);
    serde::Serializer::collect_str(&mut serde_json::Serializer::new(&mut script), &Items(items))
        .expect("strings serialize");
    script.extend_from_slice(END);
    String::from_utf8(script).expect("JSON is UTF-8")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    #[test]
    fn nested_dispatch_flushes_only_on_outer_exit() {
        let (send, received) = std::sync::mpsc::channel();
        let append = |id| {
            let send = send.clone();
            DEFERRED.with_borrow_mut(|tasks| tasks.push(Box::new(move || send.send(id).unwrap())));
        };
        let outer = Dispatching::start();
        append(1);
        let unwind = std::panic::catch_unwind(|| {
            let _inner = Dispatching::start();
            append(2);
            panic!("nested dispatch unwinds");
        });
        assert!(unwind.is_err());
        append(3);
        assert!(received.try_recv().is_err());
        drop(outer);
        assert_eq!(received.try_iter().collect::<Vec<_>>(), [1, 2, 3]);
        assert!(DEFERRED.with_borrow(Vec::is_empty));
    }

    #[test]
    fn one_turn_flushes_two_replies_for_one_page_together() {
        let page = Arc::new(Page { id: "same-page".into(), listener: 4002,
            window_label: "test".into(), responses: Weak::new() });
        let (sent, scripts) = std::sync::mpsc::channel();
        let replies = ["[1,true,0]", "[2,false,0]"];
        crate::ipc_dispatch::tests::run_turn(replies.map(|reply| {
            let page = page.clone();
            let sent = sent.clone();
            move || enqueue(&page, |entry| entry.push_item(&page, reply.into(), None), move |page| {
                let batch = PENDING.lock().unwrap().remove(&page.listener).unwrap();
                sent.send(delivery_script(&page.id, &batch.items)).unwrap();
            })
        }));
        let items = replies.map(String::from);
        assert_eq!(scripts.try_iter().collect::<Vec<_>>(), [delivery_script(&page.id, &items)]);
    }

    #[test]
    fn delivery_round_trips_both_json_layers() {
        let page = "a\"\\\n\u{2028}";
        let value = json!({"__proto__": {"text": "quote\" slash\\ line\n\u{2028}\u{2029}"}});
        let first = json!([5, value, 0]).to_string();
        let script = delivery_script(page, &[first, "[6,[0,255],1]".into()]);
        let (_, condition) = script.split_once("if (i.ipcPage === ").unwrap();
        let (guard, parse) = condition.split_once(") i.ipcBatchDeliver(JSON.parse(").unwrap();
        assert_eq!(serde_json::from_str::<String>(guard).unwrap(), page);
        let inner: String = serde_json::from_str(parse.strip_suffix(")) })()").unwrap()).unwrap();
        assert_eq!(serde_json::from_str::<Value>(&inner).unwrap(), json!([[5, value, 0], [6, [0, 255], 1]]));
    }

    #[test]
    fn large_tokens_are_scoped_to_the_live_page_and_consumed_once() {
        let mut store = LargeStore { pages: BTreeMap::new() };
        let owner = Arc::new(Responses::new(Some(BTreeMap::new())));
        let page = |id: &str, responses: &Arc<Responses>| Arc::new(Page {
            id: id.to_owned(), listener: 1, window_label: "parent".into(), responses: Arc::downgrade(responses),
        });
        store.pages.insert("main".into(), page("old", &owner));
        let old = store.current("main", "old").unwrap().clone();
        let bytes = vec![0xa5; MAX_EVAL_RAW_BYTES + 1];
        let body = || InvokeResponseBody::Raw(bytes.clone());
        assert!(old.publish(vec![(1, body()), (3, body())]));
        assert!(store.take("other", "old", 1).is_err());
        assert!(store.take("main", "new", 1).is_err());
        assert!(matches!(store.take("main", "old", 1), Ok(InvokeResponseBody::Raw(b)) if b == bytes));
        assert!(store.take("main", "old", 1).is_err());

        // The event handler still owns the bucket while its unlisten is pending.
        assert_eq!(store.invalidate("main"), Some(old.listener));
        assert!(owner.lock().unwrap().is_none());
        assert!(!old.publish(vec![(4, body())]));
        let next = Arc::new(Responses::new(Some(BTreeMap::new())));
        store.pages.insert("main".into(), page("new", &next));
        assert!(store.take("main", "old", 3).is_err());
        assert!(store.take("main", "new", 3).is_err());
        let late_responder = store.current("main", "new").unwrap().clone();
        assert!(late_responder.publish(vec![(2, body())]));
        let other = Arc::new(Responses::new(Some(BTreeMap::new())));
        store.pages.insert("other".into(), Arc::new(Page {
            window_label: "other-window".into(), id: "other-page".into(),
            listener: 2, responses: Arc::downgrade(&other),
        }));
        let mut pending = Pending::default();
        pending.push_item(&late_responder, "ready".into(), Some((5, body())));
        assert_eq!(pending.large.len(), 1);
        PENDING.lock().unwrap().insert(late_responder.listener, pending);
        store.close_window("parent");
        let cleared = PENDING.lock().unwrap().remove(&late_responder.listener).unwrap();
        assert!(cleared.items.is_empty() && cleared.large.is_empty());
        let mut late = Pending::default();
        late.push_item(&late_responder, "late".into(), Some((6, body())));
        assert!(late.items.is_empty() && late.large.is_empty());
        assert!(!late_responder.is_open());
        assert!(next.lock().unwrap().is_none());
        assert!(store.current("other", "other-page").unwrap().is_open());
        drop(other);
        drop(next);
        assert!(late_responder.responses.upgrade().is_none());
        assert!(store.current("main", "new").is_none());
        store.prune_closed();
        assert!(store.pages.is_empty());
    }

    #[test]
    fn fetch_acl_uses_the_origin_without_credentials_path_or_query() {
        for (input, expected) in [
            ("tauri://localhost/index.html", "tauri://localhost"),
            ("https://u:p@[::1]:8443/path?q#f", "https://[::1]:8443"),
            ("https://localhost:443/path", "https://localhost"),
        ] {
            let origin = origin(&tauri::Url::parse(input).unwrap()).unwrap();
            assert_eq!(origin.header, expected);
            assert_eq!(origin.url, tauri::Url::parse(expected).unwrap());
        }
        assert!(origin(&tauri::Url::parse("data:text/plain,x").unwrap()).is_err());
    }

    #[test]
    fn invalid_payloads_leave_sibling_requests_dispatchable() {
        let deep = format!("{}0{}", "[".repeat(150), "]".repeat(150));
        let payloads = ["true", "{", r#""\ud800""#, &deep, "[0,255]"];
        let mut envelope: Vec<_> = payloads.iter().enumerate().map(|(i, payload)| json!({
            "cmd": "test", "callback": 1, "error": 2, "headers": {}, "bin": i == 4, "payload": payload
        })).collect();
        envelope.push(json!({"cmd": "empty", "callback": 1, "error": 2, "headers": {}, "bin": false}));
        let calls: Vec<Call> = serde_json::from_str(&serde_json::to_string(&envelope).unwrap()).unwrap();
        let url = tauri::Url::parse("tauri://localhost").unwrap();
        let mut results = calls.into_iter().map(|call| request(call, &url, None, "key", &HeaderValue::from_static("key")));
        assert!(matches!(results.next().unwrap().unwrap().body, InvokeBody::Json(Value::Bool(true))));
        for _ in 0..3 {
            assert!(results.next().unwrap().is_err());
        }
        assert!(matches!(results.next().unwrap().unwrap().body, InvokeBody::Raw(b) if b == [0, 255]));
        assert!(matches!(results.next().unwrap().unwrap().body, InvokeBody::Json(v) if v == json!({})));
    }
}
