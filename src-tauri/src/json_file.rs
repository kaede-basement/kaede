use crate::file_system::{persist_temp_path, staging_file};
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    time::SystemTime,
};

#[cfg(windows)]
fn private_stage(parent: &Path) -> io::Result<tempfile::NamedTempFile> {
    use std::{
        ffi::c_void,
        os::windows::{ffi::OsStrExt, io::FromRawHandle},
    };
    #[repr(C)]
    struct Attributes {
        length: u32,
        descriptor: *mut c_void,
        inherit: i32,
    }
    #[link(name = "advapi32")]
    extern "system" {
        fn ConvertStringSecurityDescriptorToSecurityDescriptorW(
            s: *const u16,
            revision: u32,
            descriptor: *mut *mut c_void,
            size: *mut u32,
        ) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn CreateFileW(
            path: *const u16,
            access: u32,
            share: u32,
            security: *const Attributes,
            creation: u32,
            flags: u32,
            template: *mut c_void,
        ) -> *mut c_void;
        fn LocalFree(ptr: *mut c_void) -> *mut c_void;
    }
    // A protected DACL with one OWNER RIGHTS ACE applies before any handle can open the file.
    let sddl: Vec<_> = "D:P(A;;FA;;;OW)\0".encode_utf16().collect();
    tempfile::Builder::new().make_in(parent, |path| {
        let wide =
            crate::file_system::verbatim_path(&path.as_os_str().encode_wide().collect::<Vec<_>>())?;
        let mut attrs = Attributes {
            length: size_of::<Attributes>() as u32,
            descriptor: std::ptr::null_mut(),
            inherit: 0,
        };
        unsafe {
            if ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                1,
                &mut attrs.descriptor,
                std::ptr::null_mut(),
            ) == 0
            {
                return Err(io::Error::last_os_error());
            }
            let handle = CreateFileW(
                wide.as_ptr(),
                0x40000000,
                0,
                &attrs,
                1,
                0x80,
                std::ptr::null_mut(),
            );
            let result = if handle as isize == -1 {
                Err(io::Error::last_os_error())
            } else {
                Ok(fs::File::from_raw_handle(handle))
            };
            LocalFree(attrs.descriptor);
            result
        }
    })
}

fn publish(path: &Path, bytes: &[u8], private: bool, replace: bool) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other("Missing parent"))?;
    #[cfg(windows)]
    let mut stage = if private {
        private_stage(parent)?
    } else {
        staging_file(parent)?
    };
    #[cfg(not(windows))]
    let mut stage = {
        let _ = private;
        staging_file(parent)?
    };
    stage.write_all(bytes)?;
    stage.as_file().sync_all()?;
    persist_temp_path(stage.into_temp_path(), path, replace).map_err(|e| e.error)?;
    #[cfg(unix)]
    fs::File::open(parent)?.sync_all()?;
    Ok(())
}

fn backup(path: &Path, private: bool, expected_json: Option<&str>) -> io::Result<()> {
    let bytes = fs::read(path)?;
    let matches = match expected_json {
        Some(expected) => {
            let expected: serde_json::Value = serde_json::from_str(expected)?;
            serde_json::from_slice::<serde_json::Value>(&bytes)
                .is_ok_and(|actual| actual == expected)
        }
        None => serde_json::from_slice::<serde_json::Value>(&bytes).is_err(),
    };
    if !matches {
        return Err(io::Error::other("State changed before recovery"));
    }
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| io::Error::other("Invalid filename"))?;
    let prefix = format!("{name}.corrupt-");
    let ts = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(io::Error::other)?
        .as_nanos();
    publish(
        &path.with_file_name(format!("{prefix}{ts}.bak")),
        &bytes,
        private,
        false,
    )?;
    let current_timestamp = ts;
    let mut archives = Vec::new();
    for entry in fs::read_dir(path.parent().unwrap())? {
        let entry = entry?;
        if let Some(ts) = entry
            .file_name()
            .to_str()
            .and_then(|s| s.strip_prefix(&prefix))
            .and_then(|s| s.strip_suffix(".bak"))
            .and_then(|s| s.parse::<u128>().ok())
        {
            if ts != current_timestamp && entry.file_type()?.is_file() {
                archives.push((ts, entry.path()));
            }
        }
    }
    archives.sort_unstable();
    for (_, old) in archives.drain(..archives.len().saturating_sub(2)) {
        fs::remove_file(old)?;
    }
    Ok(())
}

fn write(
    path: &Path,
    contents: &str,
    private: bool,
    preserve: bool,
    expected_json: Option<&str>,
) -> io::Result<()> {
    let dest = match fs::symlink_metadata(path) {
        Ok(_) => path.canonicalize()?,
        Err(e) if e.kind() == io::ErrorKind::NotFound => path
            .parent()
            .ok_or(e)?
            .canonicalize()?
            .join(path.file_name().unwrap()),
        Err(e) => return Err(e),
    };
    // Recovery compares, copies and replaces one snapshot across all launcher windows.
    static STATE_WRITER: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let state = matches!(
        path.file_name().and_then(|s| s.to_str()),
        Some("accounts.json" | "instances.json")
    );
    let _writer = (state || preserve).then(|| STATE_WRITER.lock().unwrap());
    if preserve {
        backup(path, private, expected_json)?;
    }
    publish(&dest, contents.as_bytes(), private, true)
}

pub(crate) async fn publish_text(
    path: PathBuf,
    contents: String,
    private: bool,
    preserve: bool,
    expected_json: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        write(
            &path,
            &contents,
            private,
            preserve,
            expected_json.as_deref(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn state_recovery_preserves_last_three_original_byte_sequences() {
        let dir = tempfile::tempdir().unwrap();
        for name in ["accounts.json", "instances.json"] {
            let path = dir.path().join(name);
            for i in 0..5 {
                fs::write(&path, [0xff, i]).unwrap();
                write(&path, "[]", true, true, None).unwrap();
            }
            let mut saved: Vec<_> = fs::read_dir(dir.path())
                .unwrap()
                .flatten()
                .filter(|e| {
                    e.file_name()
                        .to_string_lossy()
                        .starts_with(&format!("{name}.corrupt-"))
                })
                .map(|e| fs::read(e.path()).unwrap())
                .collect();
            saved.sort();
            assert_eq!(saved, [[255, 2], [255, 3], [255, 4]]);
            assert!(write(&path, "{}", true, true, None).is_err());
            assert_eq!(fs::read(path).unwrap(), b"[]");
        }
    }
    #[test]
    fn abandoned_stage_leaves_the_previous_snapshot_readable() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        write(&path, "{}", false, false, None).unwrap();
        let mut stage = staging_file(dir.path()).unwrap();
        stage.write_all(b"{").unwrap();
        stage.as_file().sync_all().unwrap();
        let (_file, _orphan) = stage.keep().unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"{}");
        let mut reader = fs::File::open(&path).unwrap();
        write(&path, "[]", false, false, None).unwrap();
        let mut original = String::new();
        io::Read::read_to_string(&mut reader, &mut original).unwrap();
        assert_eq!(original, "{}");
        assert_eq!(fs::read(&path).unwrap(), b"[]");
    }

    #[cfg(windows)]
    #[test]
    fn private_windows_publications_have_only_the_owner_rights_ace() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("accounts.json");
        fs::write(&path, "{").unwrap();
        write(&path, "[]", true, true, None).unwrap();
        for entry in fs::read_dir(dir.path()).unwrap() {
            let result = std::process::Command::new("powershell.exe").args(["-NoProfile", "-NonInteractive", "-Command",
                "$acl = Get-Acl -LiteralPath $env:KAEDE_ACL_PATH; $rules = $acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]); if (!$acl.AreAccessRulesProtected -or $rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne 'S-1-3-4' -or $rules[0].AccessControlType -ne 'Allow') { exit 1 }"])
                .env("KAEDE_ACL_PATH", entry.unwrap().path()).status().unwrap();
            assert!(result.success());
        }
    }
    #[cfg(unix)]
    #[test]
    fn publication_keeps_link_and_private_target() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("actual");
        let link = dir.path().join("accounts.json");
        fs::write(&dest, "old").unwrap();
        symlink(&dest, &link).unwrap();
        write(&link, "new", true, false, None).unwrap();
        assert!(link.is_symlink());
        assert_eq!(fs::read(&dest).unwrap(), b"new");
        assert_eq!(dest.metadata().unwrap().permissions().mode() & 0o777, 0o600);
    }
}
