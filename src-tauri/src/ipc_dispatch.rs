//! Worker tasks carry serialized messages and numeric IDs. The event loop owns
//! the native channels and resolvers, including their Webview drop callbacks.
use std::{
    cell::{Cell, RefCell},
    collections::{HashMap, VecDeque},
    future::Future,
    pin::Pin,
    sync::{Arc, Mutex, OnceLock},
    time::Duration,
};
use tauri::{
    ipc::{Channel, InvokeError, InvokeResponseBody, IpcResponse},
    AppHandle,
};

type Task = Box<dyn FnOnce() + Send>;
type Post = Arc<dyn Fn(Task) -> tauri::Result<()> + Send + Sync>;
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

const MAX_DRAIN_BATCH: usize = 64;
const WAKE_RETRY_DELAY: Duration = Duration::from_millis(16);

type Work = Pin<Box<dyn Future<Output = ()> + Send>>;

#[derive(Default)]
struct Pending {
    actions: VecDeque<Task>,
    scheduled: bool,
    draining: bool,
    closed: bool,
}

pub(super) struct Queue {
    wake: Post,
    pending: Mutex<Pending>,
}

impl Queue {
    fn push(self: &Arc<Self>, task: Task) -> tauri::Result<()> {
        {
            let mut pending = self.pending.lock().unwrap();
            if pending.closed {
                return Err(tauri::Error::FailedToReceiveMessage);
            }
            pending.actions.push_back(task);
            if pending.scheduled || pending.draining {
                return Ok(());
            }
            pending.scheduled = true;
        }
        self.schedule();
        Ok(())
    }

    fn schedule(self: &Arc<Self>) {
        let queue = self.clone();
        if (self.wake)(Box::new(move || queue.drain(true))).is_err() {
            let queue = self.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(WAKE_RETRY_DELAY).await;
                {
                    let mut pending = queue.pending.lock().unwrap();
                    if pending.closed || pending.actions.is_empty() {
                        pending.scheduled = false;
                        return;
                    }
                }
                queue.schedule();
            });
        }
    }

    fn drain(self: &Arc<Self>, from_wakeup: bool) {
        let mut pending = self.pending.lock().unwrap();
        if from_wakeup {
            pending.scheduled = false;
        }
        if pending.draining {
            return;
        }
        pending.draining = true;
        let mut delivered = 0;
        while pending.closed || delivered < MAX_DRAIN_BATCH {
            let Some(action) = pending.actions.pop_front() else {
                break;
            };
            delivered += 1;
            drop(pending);
            action();
            pending = self.pending.lock().unwrap();
        }
        pending.draining = false;
        if !pending.actions.is_empty() && !pending.scheduled {
            pending.scheduled = true;
            drop(pending);
            // Wry executes main-thread posts inline. Post the next turn from a worker.
            let queue = self.clone();
            tauri::async_runtime::spawn(async move { queue.schedule() });
        }
    }
}

#[derive(Clone)]
pub(super) struct Dispatcher {
    queue: Arc<Queue>,
    spawn: Arc<dyn Fn(Work) + Send + Sync>,
}

impl Dispatcher {
    fn new(wake: Post, spawn: impl Fn(Work) + Send + Sync + 'static) -> Self {
        Self {
            queue: Arc::new(Queue {
                wake,
                pending: Mutex::default(),
            }),
            spawn: Arc::new(spawn),
        }
    }

    pub(super) fn for_app(app: &AppHandle) -> Self {
        // Workers post through a borrowed handle; its native owner lives for the event loop's lifetime.
        static APP: OnceLock<AppHandle> = OnceLock::new();
        let app = APP.get_or_init(|| app.clone());
        Self::new(Arc::new(move |task| app.run_on_main_thread(task)), |work| {
            tauri::async_runtime::spawn(work);
        })
    }

    pub(super) fn shutdown(&self) {
        self.queue.pending.lock().unwrap().closed = true;
        self.queue.drain(false);
        let pending = REPLIES.take();
        for respond in pending.into_values() {
            respond(Err("Application exiting".into()));
        }
        drop(CHANNELS.take());
    }

    pub(super) fn dispatch<R, T, F>(
        &self,
        incoming: tauri::ipc::Invoke<R>,
        bind: impl FnOnce(&crate::Invoke<R>) -> Result<F, InvokeError>,
    ) -> bool
    where
        R: tauri::Runtime,
        T: IpcResponse,
        F: Future<Output = Result<T, String>> + Send + 'static,
    {
        if self.queue.pending.lock().unwrap().closed {
            incoming.resolver.reject("Application exiting");
            return true;
        }
        (self.spawn)(Box::pin(prepare(incoming, self.queue.clone(), bind)));
        true
    }
}

struct Completion {
    queue: Arc<Queue>,
    id: Option<u64>,
}

impl Completion {
    fn finish(&mut self, reply: Reply) {
        if let Some(id) = self.id.take() {
            if let Err(error) = self.queue.push(Box::new(move || {
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
    queue: Arc<Queue>,
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
        queue: queue.clone(),
    });
    let pending = match bound {
        Ok(work) => {
            let id = next_id();
            REPLIES.with_borrow_mut(|pending| {
                pending.insert(id, Box::new(move |reply| resolver.respond(reply)))
            });
            Some((
                Completion {
                    queue,
                    id: Some(id),
                },
                work,
            ))
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

struct ChannelHandle {
    id: u64,
    queue: Arc<Queue>,
}

impl Drop for ChannelHandle {
    fn drop(&mut self) {
        let id = self.id;
        let _ = self.queue.push(Box::new(move || {
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
    Ok(worker_channel(native, invoke.queue.clone(), delivery))
}

fn worker_channel<T>(native: Channel, queue: Arc<Queue>, delivery: Delivery) -> Channel<T> {
    let id = next_id();
    CHANNELS.with_borrow_mut(|channels| channels.insert(id, native));
    let handle = ChannelHandle { id, queue };
    Channel::new(move |body| {
        // Log stop waits for an admitted send. Its blocking polling worker needs
        // the delivery result; download progress callers only enqueue updates.
        let ack = matches!(delivery, Delivery::Wait).then(std::sync::mpsc::channel);
        let (tx, rx) = ack.unzip();
        let id = handle.id;
        handle.queue.push(Box::new(move || {
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
    use std::{
        sync::{mpsc, Barrier},
        thread,
    };
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
        let barrier = Arc::new(Barrier::new(2));
        let entered = barrier.clone();
        let native = Channel::new(move |body| {
            let _keep_alive = &release;
            assert_eq!(thread::current().id(), owner);
            assert_eq!(body.deserialize::<u32>().unwrap(), 17);
            Err(tauri::Error::AssetNotFound("delivery".into()))
        });
        let (post, tasks) = event_queue();
        let queue = Arc::new(Queue {
            wake: post,
            pending: Mutex::default(),
        });
        let proxy = worker_channel(native, queue, Delivery::Wait);
        let worker = thread::spawn(move || {
            entered.wait();
            assert!(matches!(
                proxy.send(17_u32),
                Err(tauri::Error::AssetNotFound(_))
            ));
        });
        barrier.wait();
        let deliver = tasks.recv_timeout(Duration::from_secs(5)).unwrap();
        deliver();
        worker.join().unwrap();
        for wake in tasks.try_iter() {
            wake();
        }
        assert_eq!(dropped.try_recv().unwrap(), owner);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn dispatch_binds_in_order_and_replies_and_releases_channels_on_event_thread() {
        let (post, tasks) = event_queue();
        let reject_first = std::sync::atomic::AtomicBool::new(true);
        let (submit, workers) = mpsc::channel::<Work>();
        let dispatcher = Dispatcher::new(
            Arc::new(move |task| {
                if reject_first.swap(false, std::sync::atomic::Ordering::Relaxed) {
                    Err(tauri::Error::FailedToReceiveMessage)
                } else {
                    post(task)
                }
            }),
            move |work| submit.send(work).unwrap(),
        );
        let owner = thread::current().id();
        let quiet_file = tempfile::NamedTempFile::new().unwrap();
        let (events, progress) = mpsc::channel();
        let app = mock_builder()
            .channel_interceptor(move |_, callback, _, body| {
                assert_eq!(thread::current().id(), owner);
                events
                    .send((
                        callback.0,
                        body.clone().deserialize::<serde_json::Value>().unwrap(),
                    ))
                    .unwrap();
                true
            })
            .manage(Arc::new(crate::logging::LogTail::new(
                quiet_file.path().into(),
            )))
            .manage(crate::downloads::CancelFlags::default())
            .manage(dispatcher.clone())
            .invoke_handler(crate::bind_at_dispatch(|_| false))
            .build(mock_context(noop_assets()))
            .unwrap();
        let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        let dispatch_to = |view: &tauri::Webview<tauri::test::MockRuntime>, cmd: &str, body| {
            let (tx, rx) = mpsc::channel();
            view.clone().on_message(
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
        let dispatch = |cmd: &str, body| dispatch_to(window.as_ref(), cmd, body);
        let batch = || {
            dispatch(
                "concurrently_download",
                serde_json::json!({
                    "cancelId":"id","entries":[{"url":"invalid","path":"unused"}],"label":"batch",
                    "concurrency":1,"debug":false,"onProgress":"__CHANNEL__:1"
                }),
            )
        };
        let (start, report) = batch();
        let (record, received) = mpsc::channel();
        let backlog = MAX_DRAIN_BATCH * 2 + 1;
        let queued = worker_channel(
            Channel::new(move |body| {
                assert_eq!(thread::current().id(), owner);
                record.send(body.deserialize::<usize>()?).unwrap();
                Ok(())
            }),
            dispatcher.queue.clone(),
            Delivery::Queued,
        );
        for index in 0..backlog {
            queued.send(index).unwrap();
        }
        drop(queued);
        let (cancel, cancelled) =
            dispatch("cancel_downloads", serde_json::json!({"cancelId":"id"}));
        assert!(received.try_recv().is_err());
        tokio::spawn(cancel).await.unwrap();
        tokio::spawn(start).await.unwrap();
        for start in (0..backlog).step_by(MAX_DRAIN_BATCH) {
            tasks.recv_timeout(Duration::from_secs(5)).unwrap()();
            assert_eq!(
                received.try_iter().collect::<Vec<_>>(),
                (start..(start + MAX_DRAIN_BATCH).min(backlog)).collect::<Vec<_>>()
            );
        }
        assert_eq!(
            progress.try_iter().last().unwrap(),
            (
                1,
                serde_json::json!({"current":{}, "success":0, "failed":0})
            )
        );
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
            let (work, reply) = batch();
            assert_eq!(CHANNELS.with_borrow(HashMap::len), 1);
            if abort {
                thread::spawn(move || drop(work)).join().unwrap();
            } else {
                let panic = tokio::spawn(async move {
                    let mut work = work;
                    assert!(futures_util::poll!(&mut work).is_pending());
                    panic!("worker interrupted");
                })
                .await
                .unwrap_err()
                .into_panic();
                assert_eq!(panic.downcast_ref::<&str>(), Some(&"worker interrupted"));
            }
            tasks.recv_timeout(Duration::from_secs(5)).unwrap()();
            let InvokeResponse::Err(error) = reply.try_recv().unwrap() else {
                panic!("interrupted command succeeded")
            };
            assert_eq!(error.0, "IPC command interrupted");
            assert!(matches!(
                reply.try_recv(),
                Err(mpsc::TryRecvError::Disconnected)
            ));
            while !CHANNELS.with_borrow(HashMap::is_empty) {
                tasks.recv_timeout(Duration::from_secs(5)).unwrap()();
            }
        }
        let quiet = tauri::WebviewWindowBuilder::new(&app, "quiet", Default::default())
            .build()
            .unwrap();
        let view: &tauri::Webview<_> = quiet.as_ref();
        let parent = view.window();
        use tauri::Manager;
        crate::logging::page_changed(&mut parent.resources_table(), false);
        let (work, reply) = dispatch_to(
            view,
            "stream_logs",
            serde_json::json!({"onEvent":"__CHANNEL__:2"}),
        );
        let stream = tokio::spawn(work);
        tasks.recv_timeout(Duration::from_secs(5)).unwrap()();
        assert_eq!(
            progress.try_recv().unwrap(),
            (2, serde_json::json!({"type":"snapshot", "data":[]}))
        );
        view.close().unwrap();
        assert!(parent.webviews().is_empty());
        tokio::time::timeout(Duration::from_secs(5), stream)
            .await
            .unwrap()
            .unwrap();
        while !REPLIES.with_borrow(HashMap::is_empty) || !CHANNELS.with_borrow(HashMap::is_empty) {
            tasks.recv_timeout(Duration::from_secs(5)).unwrap()();
        }
        assert!(matches!(reply.try_recv(), Ok(InvokeResponse::Ok(_))));

        let (never_polled, interrupted) = batch();
        let (pending, reply) = dispatch("cancel_downloads", serde_json::json!({"cancelId":"id"}));
        tokio::spawn(pending).await.unwrap();
        dispatcher.shutdown();
        let InvokeResponse::Ok(body) = reply.try_recv().unwrap() else {
            panic!("exit discarded a queued reply");
        };
        assert!(body.deserialize::<bool>().unwrap());
        assert!(matches!(interrupted.try_recv(), Ok(InvokeResponse::Err(_))));
        thread::spawn(move || drop(never_polled)).join().unwrap();
        assert!(REPLIES.with_borrow(HashMap::is_empty));
        assert!(CHANNELS.with_borrow(HashMap::is_empty));
    }
}
