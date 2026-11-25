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

fn backup(path: &Path, private: bool, expected_hash: Option<&str>) -> io::Result<()> {
    use sha2::{Digest, Sha256};
    let bytes = fs::read(path).map_err(|e| {
        if e.kind() == io::ErrorKind::NotFound {
            io::Error::other("State changed before recovery")
        } else {
            e
        }
    })?;
    if expected_hash != Some(format!("{:x}", Sha256::digest(&bytes)).as_str()) {
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
            if entry.file_type()?.is_file() {
                archives.push((ts, entry.path()));
            }
        }
    }
    archives.sort_unstable();
    const LIMIT: usize = 3;
    let duplicate = archives.iter().find(|(_, archive)| {
        fs::metadata(archive).is_ok_and(|meta| meta.len() == bytes.len() as u64)
            && fs::read(archive).is_ok_and(|saved| saved == bytes)
    });
    let mut excess = (archives.len() + usize::from(duplicate.is_none())).saturating_sub(LIMIT);
    let mut last_error = None;
    for entry in &archives {
        if excess == 0 {
            break;
        }
        if Some(entry) == duplicate {
            continue;
        }
        match fs::remove_file(&entry.1) {
            Ok(()) => excess -= 1,
            Err(e) => last_error = Some(e),
        }
    }
    if excess != 0 {
        return Err(last_error.unwrap());
    }
    if duplicate.is_none() {
        publish(
            &path.with_file_name(format!("{prefix}{ts}.bak")),
            &bytes,
            private,
            false,
        )?;
    }
    Ok(())
}

fn destination(path: &Path) -> io::Result<PathBuf> {
    let mut seen = std::collections::HashSet::new();
    let mut path = path.to_owned();
    loop {
        let parent = path
            .parent()
            .ok_or_else(|| io::Error::other("Missing parent"))?
            .canonicalize()?;
        let name = path
            .file_name()
            .ok_or_else(|| io::Error::other("Missing filename"))?;
        path = parent.join(name);
        match fs::symlink_metadata(&path) {
            Ok(meta) if meta.file_type().is_symlink() => {
                if !seen.insert(path.clone()) {
                    return Err(io::Error::other("Symlink cycle"));
                }
                path = parent.join(fs::read_link(&path)?);
            }
            Ok(_) => return Ok(path),
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(path),
            Err(e) => return Err(e),
        }
    }
}

fn write(
    path: &Path,
    contents: &str,
    private: bool,
    preserve: bool,
    expected_hash: Option<&str>,
) -> io::Result<()> {
    // Recovery compares, copies and replaces one snapshot across all launcher windows.
    static STATE_WRITER: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let state = matches!(
        path.file_name().and_then(|s| s.to_str()),
        Some("accounts.json" | "instances.json")
    );
    let _writer = (state || preserve).then(|| STATE_WRITER.lock().unwrap());
    let dest = destination(path)?;
    if expected_hash == Some("missing") {
        return publish(&dest, contents.as_bytes(), private, false).map_err(|e| {
            if e.kind() == io::ErrorKind::AlreadyExists {
                io::Error::other("State changed before recovery")
            } else {
                e
            }
        });
    }
    if preserve {
        backup(path, private, expected_hash)?;
    }
    publish(&dest, contents.as_bytes(), private, true)
}

pub(crate) async fn publish_text(
    path: PathBuf,
    contents: String,
    private: bool,
    preserve: bool,
    expected_hash: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        write(
            &path,
            &contents,
            private,
            preserve,
            expected_hash.as_deref(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};
    #[test]
    fn state_recovery_preserves_last_three_original_byte_sequences() {
        let dir = tempfile::tempdir().unwrap();
        for name in ["accounts.json", "instances.json"] {
            let path = dir.path().join(name);
            for i in 0..5 {
                fs::write(&path, [0xff, i]).unwrap();
                write(
                    &path,
                    "[]",
                    true,
                    true,
                    Some(&format!("{:x}", Sha256::digest(fs::read(&path).unwrap()))),
                )
                .unwrap();
            }
            for _ in 0..4 {
                fs::write(&path, [255, 3]).unwrap();
                write(
                    &path,
                    "[]",
                    true,
                    true,
                    Some(&format!("{:x}", Sha256::digest([255, 3]))),
                )
                .unwrap();
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
    #[cfg(windows)]
    #[test]
    fn locked_backup_cannot_grow_the_archive_set() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("accounts.json");
        for n in 0..3 {
            fs::write(
                dir.path().join(format!("accounts.json.corrupt-{n}.bak")),
                [n],
            )
            .unwrap();
        }
        let lock = |n| {
            fs::File::options()
                .read(true)
                .share_mode(0)
                .open(dir.path().join(format!("accounts.json.corrupt-{n}.bak")))
                .unwrap()
        };
        let _oldest = lock(0);
        fs::write(&path, [2]).unwrap();
        write(
            &path,
            "[]",
            true,
            true,
            Some(&format!("{:x}", Sha256::digest([2]))),
        )
        .unwrap();
        assert!(dir.path().join("accounts.json.corrupt-1.bak").exists());
        let _rest = [lock(1), lock(2)];
        fs::write(&path, [9]).unwrap();
        for _ in 0..4 {
            assert!(write(
                &path,
                "[]",
                true,
                true,
                Some(&format!("{:x}", Sha256::digest([9])))
            )
            .is_err());
            assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 4);
            assert_eq!(fs::read(&path).unwrap(), [9]);
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
        write(
            &path,
            "[]",
            true,
            true,
            Some(&format!("{:x}", Sha256::digest(fs::read(&path).unwrap()))),
        )
        .unwrap();
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
        let parent = dir.path().join("profile");
        fs::create_dir(&parent).unwrap();
        let dest = parent.join("actual");
        let link = dir.path().join("accounts.json");
        let intermediate = dir.path().join("profile-link");
        symlink("profile/actual", &intermediate).unwrap();
        symlink("profile-link", &link).unwrap();
        write(&link, "new", true, false, None).unwrap();
        assert!(link.is_symlink());
        assert_eq!(fs::read(&dest).unwrap(), b"new");
        assert_eq!(dest.metadata().unwrap().permissions().mode() & 0o777, 0o600);
    }
}
