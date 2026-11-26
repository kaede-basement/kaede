///
/// ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning),
/// but the code here was initially written by me in TypeScript (so this is a rewrite)
///
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use rayon::prelude::*;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherInitReport {
    pub created_directories: Vec<String>,
    pub java_major: Option<u32>,
    // "release-file" (JVM was not spawned)
    // "spawn" (JVM was spawned)
    // "unresolved" (returns None)
    pub java_major_source: &'static str,
}

#[tauri::command]
pub async fn finalize_initialization(
    base_directory: String,
    folders: Vec<String>,
    java_binary: String,
) -> Result<LauncherInitReport, String> {
    let dirs_task = tokio::task::spawn_blocking(move || {
        ensure_directories(Path::new(&base_directory), &folders)
    });
    let java_task = tokio::task::spawn_blocking(move || detect_java_major(&java_binary));

    let (dirs, java) = tokio::join!(dirs_task, java_task);

    let created_directories = dirs
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("Failed to create launcher directories: {}", e))?;
    let (java_major, java_major_source) = java.map_err(|e| e.to_string())?;

    Ok(LauncherInitReport {
        created_directories,
        java_major,
        java_major_source,
    })
}

fn ensure_directories(base: &Path, folders: &[String]) -> io::Result<Vec<String>> {
    let mut created = Vec::new();

    for folder in folders {
        let path = base.join(folder);

        if !path.exists() {
            fs::create_dir_all(&path)?;
            created.push(path.to_string_lossy().to_string());
        }
    }

    Ok(created)
}

// JDK vendors may ship a 'release' file next to 'bin/' containing
// JAVA_VERSION="...". It is useful if we do not want to spawn
// a Java process to get the version major from that process output
fn detect_java_major(java_binary: &str) -> (Option<u32>, &'static str) {
    let Some(exe) = resolve_java_path(java_binary) else {
        return (None, "unresolved");
    };

    if let Some(major) = major_from_release_file(&exe) {
        return (Some(major), "release-file");
    }

    if let Some(major) = major_from_spawn(&exe) {
        return (Some(major), "spawn");
    }

    (None, "unresolved")
}

fn resolve_java_path(java_binary: &str) -> Option<PathBuf> {
    let path = Path::new(java_binary);

    if path.is_absolute() {
        return path.is_file().then(|| path.to_path_buf());
    }

    // returns ".exe" on Windows and "" elsewhere
    let suffix = std::env::consts::EXE_SUFFIX;
    let mut exe_name = java_binary.to_string();

    if !suffix.is_empty() && !exe_name.ends_with(suffix) {
        exe_name.push_str(suffix);
    }

    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|dir| dir.join(&exe_name))
            .find(|candidate| candidate.is_file())
    })
}

fn read_release_file(java_exe: &Path) -> Option<(String, Option<String>)> {
    let exe = java_exe.canonicalize().ok()?;
    let content = fs::read_to_string(exe.parent()?.parent()?.join("release")).ok()?;
    let mut version = None;
    let mut vendor = None;
    for (key, value) in content.lines().filter_map(|line| line.split_once('=')) {
        let value = value.trim().trim_matches('"');
        match key.trim() {
            "JAVA_VERSION" => version = Some(value.to_owned()),
            "IMPLEMENTOR" => vendor = Some(value.to_owned()),
            _ => {}
        }
    }
    Some((version?, vendor))
}

fn major_from_release_file(java_exe: &Path) -> Option<u32> {
    parse_java_major(&read_release_file(java_exe)?.0)
}

// Spawns the JVM with '-version' and returns the useful part of the output
fn banner_from_spawn(java_exe: &Path) -> Option<String> {
    let spawn_target = if java_exe.file_stem().and_then(|s| s.to_str()) == Some("javaw") {
        let sibling = java_exe.with_file_name(format!("java{}", std::env::consts::EXE_SUFFIX));
        if sibling.is_file() {
            sibling
        } else {
            java_exe.to_path_buf()
        }
    } else {
        java_exe.to_path_buf()
    };

    let mut command = Command::new(spawn_target);
    // '-version' instead of '--version' since '--version' fails in Java 8 and older
    command.arg("-version");

    // Prevent a console window from flashing on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let child = {
        #[cfg(all(unix, not(target_os = "linux")))]
        let _guard = crate::processes::lock_unix_spawn();
        command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .ok()?
    };
    let output = child.wait_with_output().ok()?;

    // Goes to stderr, but we should probably check for stdout as well
    let stderr = String::from_utf8_lossy(&output.stderr);
    let banner = if stderr.trim().is_empty() {
        String::from_utf8_lossy(&output.stdout)
    } else {
        stderr
    };

    Some(banner.into_owned())
}

fn major_from_spawn(java_exe: &Path) -> Option<u32> {
    major_from_banner(&banner_from_spawn(java_exe)?)
}

// banner is:
//   openjdk version "25.0.1" 2025-10-21 LTS
//   java version "1.8.0_472"
fn major_from_banner(banner: &str) -> Option<u32> {
    let version_line = banner.lines().find(|line| line.contains("version"))?;
    let quoted = version_line.split('"').nth(1)?;

    parse_java_major(quoted)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaMajorReport {
    pub major: Option<u32>,
    pub source: &'static str,
}

#[tauri::command]
pub async fn get_java_major(java_binary: String) -> Result<JavaMajorReport, String> {
    tokio::task::spawn_blocking(move || detect_java_major(&java_binary))
        .await
        .map(|(major, source)| JavaMajorReport { major, source })
        .map_err(|e| e.to_string())
}

// "25.0.2"    -> 25
// "21"        -> 21
// "21.0.1+12" -> 21
// "1.8.0_472" -> 8
fn parse_java_major(version: &str) -> Option<u32> {
    let mut parts = version.split(['.', '_', '-', '+']);
    let first: u32 = parts.next()?.trim().parse().ok()?;

    if first == 1 {
        parts.next()?.trim().parse().ok()
    } else {
        Some(first)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaInstallation {
    pub path: String,
    pub vendor: String,
    pub version: String,
    pub major: Option<u32>,
    // "environment" (found by the command)
    // "java-home" (found thanks to 'JAVA_HOME')
    // "path" (found in 'PATH')
    // "scan" (found in usual JVM directories)
    pub source: &'static str,
}

#[tauri::command]
pub async fn detect_java_installations() -> Result<Vec<JavaInstallation>, String> {
    tokio::task::spawn_blocking(collect_java_installations)
        .await
        .map_err(|e| e.to_string())
}

fn collect_java_installations() -> Vec<JavaInstallation> {
    let mut seen = HashSet::new();
    let mut candidates: Vec<(PathBuf, &'static str)> = Vec::new();

    // Avoid duplicates
    for (candidate, source) in gather_java_candidates() {
        let canonical = fs::canonicalize(&candidate).unwrap_or_else(|_| candidate.clone());

        if !seen.insert(canonical) {
            continue;
        }

        candidates.push((candidate, source));
    }

    let mut installations: Vec<JavaInstallation> = candidates
        .into_par_iter()
        .filter_map(|(candidate, source)| probe_java_installation(&candidate, source))
        .collect();

    // Sort from newest to oldest
    installations.sort_by(|first, second| {
        second
            .major
            .cmp(&first.major)
            .then_with(|| first.path.cmp(&second.path))
    });

    installations
}

fn gather_java_candidates() -> Vec<(PathBuf, &'static str)> {
    let executable = format!("java{}", std::env::consts::EXE_SUFFIX);
    let mut candidates: Vec<(PathBuf, &'static str)> = Vec::new();

    if let Some(java_home) = std::env::var_os("JAVA_HOME") {
        candidates.push((
            Path::new(&java_home).join("bin").join(&executable),
            "java-home",
        ));
    }

    if let Some(paths) = std::env::var_os("PATH") {
        let mut paths = std::env::split_paths(&paths)
            .map(|dir| dir.join(&executable))
            .filter(|p| p.is_file());
        if let Some(first) = paths.next() {
            candidates.insert(0, (first, "environment"));
        }
        candidates.extend(paths.map(|p| (p, "path")));
    }

    for root in java_directory_roots() {
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };

        for entry in entries.flatten() {
            let home = entry.path();

            // On macOS, the JVM home is nested inside the bundle
            #[cfg(target_os = "macos")]
            candidates.push((
                home.join("Contents")
                    .join("Home")
                    .join("bin")
                    .join(&executable),
                "scan",
            ));

            candidates.push((home.join("bin").join(&executable), "scan"));
        }
    }

    candidates.retain(|(candidate, _)| candidate.is_file());

    candidates
}

fn java_directory_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();

    #[cfg(windows)]
    {
        let program_files = [
            std::env::var_os("ProgramFiles"),
            std::env::var_os("ProgramFiles(x86)"),
        ];

        for base in program_files.into_iter().flatten() {
            let base = PathBuf::from(base);

            roots.push(base.join("Java"));
            roots.push(base.join("Eclipse Adoptium"));
            roots.push(base.join("Zulu"));
            roots.push(base.join("Amazon Corretto"));
            roots.push(base.join("BellSoft"));
            roots.push(base.join("Microsoft"));
        }

        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            roots.push(
                PathBuf::from(local)
                    .join("Programs")
                    .join("Eclipse Adoptium"),
            );
        }
    }

    #[cfg(target_os = "macos")]
    {
        roots.push(PathBuf::from("/Library/Java/JavaVirtualMachines"));
        roots.push(PathBuf::from("/System/Library/Java/JavaVirtualMachines"));
        roots.push(PathBuf::from("/opt/homebrew/opt"));
        roots.push(PathBuf::from("/usr/local/opt"));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        roots.push(PathBuf::from("/usr/lib/jvm"));
        roots.push(PathBuf::from("/usr/lib64/jvm"));
        roots.push(PathBuf::from("/usr/java"));
        roots.push(PathBuf::from("/opt/java"));
    }

    roots
}

fn probe_java_installation(java_exe: &Path, source: &'static str) -> Option<JavaInstallation> {
    let path = java_exe.to_string_lossy().to_string();

    // Reading the 'release' file is much cheaper than spawning a JVM
    let (version, vendor) = if let Some((version, vendor)) = read_release_file(java_exe) {
        (version, vendor.unwrap_or_else(|| "Unknown".to_owned()))
    } else {
        let banner = banner_from_spawn(java_exe)?;
        let line = banner.lines().find(|line| line.contains("version"))?;
        let vendor = match line.split_whitespace().next() {
            Some("openjdk") => "OpenJDK",
            Some("java") => "Oracle",
            _ => "Unknown",
        };
        (line.split('"').nth(1)?.to_owned(), vendor.to_owned())
    };
    Some(JavaInstallation {
        path,
        vendor,
        major: parse_java_major(&version),
        version,
        source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn legacy_version() {
        assert_eq!(parse_java_major("1.8.0_472"), Some(8));
    }
    #[cfg(unix)]
    #[test]
    fn linked_binary_uses_real_release_and_keeps_launch_path() {
        let tmp = tempfile::tempdir().unwrap();
        let bin = tmp.path().join("jdk/bin");
        fs::create_dir_all(&bin).unwrap();
        fs::write(bin.join("java"), "").unwrap();
        fs::write(
            bin.parent().unwrap().join("release"),
            "JAVA_VERSION=1.8.0_472\nIMPLEMENTOR=Test",
        )
        .unwrap();
        let link = tmp.path().join("java");
        std::os::unix::fs::symlink(bin.join("java"), &link).unwrap();
        let java = probe_java_installation(&link, "path").unwrap();
        assert_eq!(java.major, Some(8));
        assert_eq!(java.vendor, "Test");
        assert_eq!(Path::new(&java.path), link);
    }
}
