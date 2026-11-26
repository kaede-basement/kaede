use std::sync::Mutex;
use sysinfo::System;
use tokio::sync::OnceCell;

static MEMORY: Mutex<Option<System>> = Mutex::new(None);
static CPU: OnceCell<Mutex<System>> = OnceCell::const_new();

pub async fn get_system_memory() -> Result<(u64, u64), String> {
    tokio::task::spawn_blocking(|| {
        let mut memory = MEMORY.lock().unwrap();
        let sys = memory.get_or_insert_with(System::new);
        sys.refresh_memory();
        (sys.used_memory(), sys.total_memory())
    })
    .await
    .map_err(|e| e.to_string())
}

pub async fn get_cpu_usage() -> Result<f32, String> {
    let cpu = CPU
        .get_or_try_init(|| async {
            let sys = tokio::task::spawn_blocking(|| {
                let mut sys = System::new();
                sys.refresh_cpu_usage();
                sys
            })
            .await
            .map_err(|e| e.to_string())?;
            tokio::time::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL).await;
            Ok::<_, String>(Mutex::new(sys))
        })
        .await?;
    tokio::task::spawn_blocking(move || {
        let mut sys = cpu.lock().unwrap();
        sys.refresh_cpu_usage();
        sys.global_cpu_usage()
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn check_contention<T: Send + 'static, R>(
        lock: &'static Mutex<T>,
        sample: impl std::future::Future<Output = Result<R, String>>,
    ) -> R {
        let (held, ready) = tokio::sync::oneshot::channel();
        let (release, wait) = std::sync::mpsc::channel();
        let holder = tokio::task::spawn_blocking(move || {
            let _lock = lock.lock().unwrap();
            held.send(()).unwrap();
            wait.recv_timeout(std::time::Duration::from_secs(5))
                .unwrap();
        });
        ready.await.unwrap();
        tokio::pin!(sample);
        assert!(futures_util::poll!(&mut sample).is_pending());
        tokio::spawn(async move { release.send(()).unwrap() })
            .await
            .unwrap();
        holder.await.unwrap();
        sample.await.unwrap()
    }

    #[tokio::test]
    async fn contended_samplers_yield_to_runtime() {
        assert!(check_contention(&MEMORY, get_system_memory()).await.1 > 0);
        get_cpu_usage().await.unwrap();
        assert!(check_contention(CPU.get().unwrap(), get_cpu_usage())
            .await
            .is_finite());
    }
}
