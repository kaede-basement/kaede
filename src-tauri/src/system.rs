use std::process;
use sysinfo::{System, Pid};

#[tauri::command]
pub fn get_system_memory() -> (u64, u64) {
    let mut sys = System::new_all();

    sys.refresh_memory();

    let used_memory = sys.used_memory();
    let total_memory = sys.total_memory();

    return (used_memory, total_memory);
}

#[tauri::command]
pub fn get_process_memory() -> (u64, u64) {
    let mut sys = System::new_all();

    sys.refresh_memory();

    // Get the current application process idg
    let pid = process::id();

    if let Some(process) = sys.process(Pid::from_u32(pid)) {
        let process_memory = process.memory();
        let process_virtual_memory = process.virtual_memory();

        return (process_memory, process_virtual_memory);
    } else {
        return (0, 0);
    }
}