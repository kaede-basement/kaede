//! Worker tasks carry serialized messages and numeric IDs. The event loop owns
//! the native channels and resolvers, including their Webview drop callbacks.
use std::{
    cell::{Cell, RefCell},
    collections::HashMap,
    future::Future,
    sync::{Arc, OnceLock},
};
use tauri::{
    ipc::{Channel, InvokeError, InvokeResponseBody, IpcResponse},
    AppHandle, Manager,
};

type Task = Box<dyn FnOnce() + Send>;
pub(super) type Post = Arc<dyn Fn(Task) -> tauri::Result<()> + Send + Sync>;
type Reply = Result<InvokeResponseBody, InvokeError>;
type Responder = Box<dyn FnOnce(Reply)>;

thread_local! {
    static NEXT: Cell<u64> = const { Cell::new(0) };
    static REPLIES: RefCell<HashMap<u64, Responder>> = RefCell::default();
    static CHANNELS: RefCell<HashMap<u64, Channel>> = RefCell::default();
}

fn next_id() -> u64 {
    NEXT.with(|next| {
        let id = next.get().checked_add(1).expect("IPC IDs exhausted");
        next.set(id);
        id
    })
}

fn scheduler(app: &AppHandle) -> Post {
    // The static retains the AppHandle. Workers clone only the Arc to the posting function.
    static POST: OnceLock<Post> = OnceLock::new();
    POST.get_or_init(|| {
        let app = app.clone();
        Arc::new(move |task| app.run_on_main_thread(task))
    })
    .clone()
}

struct Completion {
    post: Post,
    id: Option<u64>,
}

impl Completion {
    fn finish(&mut self, reply: Reply) {
        if let Some(id) = self.id.take() {
            if let Err(error) = (self.post)(Box::new(move || {
                let respond = REPLIES.with_borrow_mut(|pending| pending.remove(&id));
                if let Some(respond) = respond {
                    respond(reply);
                }
            })) {
                log::debug!("IPC response could not reach the event loop: {error}");
            }
        }
    }
}

impl Drop for Completion {
    fn drop(&mut self) {
        if self.id.is_some() {
            self.finish(Err("IPC command interrupted".into()));
        }
    }
}

fn prepare<R, T, F>(
    incoming: tauri::ipc::Invoke<R>,
    post: Post,
    bind: impl FnOnce(&crate::Invoke<R>) -> Result<F, InvokeError>,
) -> impl Future<Output = ()> + Send + 'static
where
    R: tauri::Runtime,
    T: IpcResponse,
    F: Future<Output = Result<T, String>> + Send + 'static,
{
    let tauri::ipc::Invoke {
        message,
        acl,
        resolver,
        ..
    } = incoming;
    let bound = bind(&crate::Invoke {
        message,
        acl,
        post: post.clone(),
    });
    let pending = match bound {
        Ok(work) => {
            let id = next_id();
            REPLIES.with_borrow_mut(|pending| {
                pending.insert(id, Box::new(move |reply| resolver.respond(reply)))
            });
            Some((Completion { post, id: Some(id) }, work))
        }
        Err(error) => {
            resolver.invoke_error(error);
            None
        }
    };
    async move {
        if let Some((mut completion, work)) = pending {
            let reply = work
                .await
                .map_err(InvokeError::from)
                .and_then(|value| value.body().map_err(Into::into));
            completion.finish(reply);
        }
    }
}

pub(super) fn dispatch<T: IpcResponse, F: Future<Output = Result<T, String>> + Send + 'static>(
    incoming: crate::Incoming,
    bind: impl FnOnce(&crate::Invoke) -> Result<F, InvokeError>,
) -> bool {
    let post = scheduler(incoming.message.webview_ref().app_handle());
    tauri::async_runtime::spawn(prepare(incoming, post, bind));
    true
}

struct ChannelHandle {
    id: u64,
    post: Post,
}

impl Drop for ChannelHandle {
    fn drop(&mut self) {
        let id = self.id;
        let _ = (self.post)(Box::new(move || {
            drop(CHANNELS.with_borrow_mut(|channels| channels.remove(&id)));
        }));
    }
}

#[derive(Clone, Copy)]
pub(super) enum Delivery {
    Queued,
    Wait,
}

pub(super) fn channel<T, R: tauri::Runtime>(
    invoke: &crate::Invoke<R>,
    name: &'static str,
    key: &'static str,
    delivery: Delivery,
) -> Result<Channel<T>, InvokeError> {
    let native = crate::argument(invoke, name, key)?;
    Ok(worker_channel(native, invoke.post.clone(), delivery))
}

fn worker_channel<T>(native: Channel, post: Post, delivery: Delivery) -> Channel<T> {
    let id = next_id();
    CHANNELS.with_borrow_mut(|channels| channels.insert(id, native));
    let handle = ChannelHandle { id, post };
    Channel::new(move |body| {
        // Log stop waits for an admitted send. Its blocking polling worker needs
        // the delivery result; download progress callers only enqueue updates.
        let ack = matches!(delivery, Delivery::Wait).then(std::sync::mpsc::channel);
        let (tx, rx) = ack.unzip();
        let id = handle.id;
        (handle.post)(Box::new(move || {
            let native = CHANNELS.with_borrow(|channels| channels.get(&id).cloned());
            let result = native
                .ok_or(tauri::Error::FailedToReceiveMessage)
                .and_then(|native| native.send(body));
            if let Some(tx) = tx {
                let _ = tx.send(result);
            }
        }))?;
        if let Some(rx) = rx {
            rx.recv()
                .map_err(|_| tauri::Error::FailedToReceiveMessage)??;
        }
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{pin::Pin, sync::mpsc, thread, time::Duration};
    use tauri::{
        ipc::{CallbackFn, InvokeResponse},
        test::{mock_builder, mock_context, noop_assets, INVOKE_KEY},
        webview::InvokeRequest,
    };

    fn event_queue() -> (Post, mpsc::Receiver<Task>) {
        let (schedule, tasks) = mpsc::channel::<Task>();
        let post: Post = Arc::new(move |task| {
            schedule
                .send(task)
                .map_err(|_| tauri::Error::FailedToReceiveMessage)
        });
        (post, tasks)
    }

    #[test]
    fn log_delivery_is_acknowledged_and_the_channel_drops_on_the_event_thread() {
        struct OnDrop(mpsc::Sender<thread::ThreadId>);
        impl Drop for OnDrop {
            fn drop(&mut self) {
                self.0.send(thread::current().id()).unwrap();
            }
        }
        let owner = thread::current().id();
        let (released, dropped) = mpsc::channel();
        let release = OnDrop(released);
        let native = Channel::new(move |body| {
            let _keep_alive = &release;
            assert_eq!(thread::current().id(), owner);
            assert_eq!(body.deserialize::<u32>().unwrap(), 17);
            Ok(())
        });
        let (post, tasks) = event_queue();
        let proxy = worker_channel(native, post, Delivery::Wait);
        let worker = thread::spawn(move || proxy.send(17_u32).unwrap());
        let deliver = tasks.recv_timeout(Duration::from_secs(5)).unwrap();
        assert!(!worker.is_finished());
        deliver();
        worker.join().unwrap();
        assert!(dropped.try_recv().is_err());
        tasks.recv_timeout(Duration::from_secs(5)).unwrap()();
        assert_eq!(dropped.try_recv().unwrap(), owner);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn dispatch_binds_in_order_and_replies_and_releases_channels_on_event_thread() {
        async fn failing_worker() -> Result<(), String> {
            panic!("worker panic")
        }
        type Work = Pin<Box<dyn Future<Output = ()> + Send>>;
        let (post, tasks) = event_queue();
        let (submit, workers) = mpsc::channel::<Work>();
        let owner = thread::current().id();
        let app = mock_builder()
            .manage(crate::downloads::CancelFlags::default())
            .invoke_handler(move |invoke| {
                let work: Work = match invoke.message.command() {
                    "concurrently_download" => Box::pin(prepare(
                        invoke,
                        post.clone(),
                        crate::downloads::concurrently_download,
                    )),
                    "cancel_downloads" => Box::pin(prepare(
                        invoke,
                        post.clone(),
                        crate::downloads::cancel_downloads,
                    )),
                    "panic" => Box::pin(prepare(invoke, post.clone(), |_| Ok(failing_worker()))),
                    _ => return false,
                };
                submit.send(work).unwrap();
                true
            })
            .build(mock_context(noop_assets()))
            .unwrap();
        let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        let dispatch = |cmd: &str, body| {
            let (tx, rx) = mpsc::channel();
            window.as_ref().clone().on_message(
                InvokeRequest {
                    cmd: cmd.into(),
                    body: tauri::ipc::InvokeBody::Json(body),
                    callback: CallbackFn(0),
                    error: CallbackFn(1),
                    url: if cfg!(windows) {
                        "http://tauri.localhost"
                    } else {
                        "tauri://localhost"
                    }
                    .parse()
                    .unwrap(),
                    headers: Default::default(),
                    invoke_key: INVOKE_KEY.into(),
                },
                Box::new(move |_, _, response, _, _| {
                    assert_eq!(thread::current().id(), owner);
                    tx.send(response).unwrap();
                }),
            );
            (workers.recv_timeout(Duration::from_secs(5)).unwrap(), rx)
        };
        let (start, report) = dispatch(
            "concurrently_download",
            serde_json::json!({
                "cancelId":"id","entries":[{"url":"invalid","path":"unused"}],"label":"batch",
                "concurrency":1,"debug":false,"onProgress":"__CHANNEL__:1"
            }),
        );
        let (cancel, cancelled) =
            dispatch("cancel_downloads", serde_json::json!({"cancelId":"id"}));
        tokio::spawn(cancel).await.unwrap();
        tokio::spawn(start).await.unwrap();
        for task in tasks.try_iter() {
            task();
        }
        let InvokeResponse::Ok(value) = cancelled.try_recv().unwrap() else {
            panic!("cancel failed")
        };
        assert!(value.deserialize::<bool>().unwrap());
        let InvokeResponse::Ok(value) = report.try_recv().unwrap() else {
            panic!("batch failed")
        };
        let report = value.deserialize::<serde_json::Value>().unwrap();
        assert_eq!(report["cancelled"], true);
        assert_eq!(report["failed"], 0);
        for abort in [true, false] {
            let (work, reply) = dispatch("panic", serde_json::json!({}));
            if abort {
                thread::spawn(move || drop(work)).join().unwrap();
            } else {
                assert!(tokio::spawn(work).await.unwrap_err().is_panic());
            }
            tasks.recv_timeout(Duration::from_secs(5)).unwrap()();
            assert!(matches!(reply.try_recv(), Ok(InvokeResponse::Err(_))));
        }
        assert!(REPLIES.with_borrow(HashMap::is_empty));
        assert!(CHANNELS.with_borrow(HashMap::is_empty));
    }
}
