use std::sync::Mutex;
use sysinfo::System;
use tokio::sync::OnceCell;

static MEMORY: Mutex<Option<System>> = Mutex::new(None);
static CPU: OnceCell<Mutex<System>> = OnceCell::const_new();

#[tauri::command(async)]
pub fn get_system_memory() -> (u64, u64) {
    let mut memory = MEMORY.lock().unwrap();
    let sys = memory.get_or_insert_with(System::new);
    sys.refresh_memory();
    (sys.used_memory(), sys.total_memory())
}

#[tauri::command]
pub async fn get_cpu_usage() -> f32 {
    let cpu = CPU
        .get_or_init(|| async {
            let mut sys = System::new();
            sys.refresh_cpu_usage();
            tokio::time::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL).await;
            Mutex::new(sys)
        })
        .await;
    let mut sys = cpu.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.global_cpu_usage()
}
