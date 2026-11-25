use image::imageops::FilterType;
use std::path::Path;
use sha1::Sha1;

use crate::hashing::hash_bytes;

// https://stackoverflow.com/questions/45190469/how-to-identify-whether-webp-image-is-static-or-animated
// Mostly taken from:
// Source (1) - https://developers.google.com/speed/webp/docs/riff_container
// Source (2) - https://stackoverflow.com/a/52333192
// Posted by Sven Liivak, modified by community. See post 'Timeline' for change history
// Retrieved 2026-11-08, License - CC BY-SA 4.0
fn is_animated_webp(bytes: &[u8]) -> bool {
    if bytes.len() <= 20 {
        return false;
    }

    // 'Resource Interchange File Format' chunk
    let riff = &bytes[0..4] == b"RIFF";
    // FourCC 'WEBP'
    let webp = &bytes[8..12] == b"WEBP";
    // There are also 'VP8' and 'VP8L'
    let extended_header = &bytes[12..16] == b"VP8X";
    // 'VP8X.flags.hasAnimation'
    let has_animation = bytes[20] & 2 != 0;

    riff && webp && extended_header && has_animation
}

// https://stackoverflow.com/questions/4525152/can-i-programmatically-determine-if-a-png-is-animated
// Mostly taken from:
// Source - https://stackoverflow.com/a/68618296
// Posted by Sage Pointer, modified by community. See post 'Timeline' for change history
// Retrieved 2026-11-08, License - CC BY-SA 4.0
fn is_animated_png(bytes: &[u8]) -> bool {
    let header: &[u8] = b"\x89PNG\r\n\x1a\n";

    if !bytes.starts_with(header) {
        return false;
    }

    let mut offset = header.len();

    while let Some(chunk) = bytes
        .get(offset..)
        .and_then(|rest| rest.get(..8)) {
        let length = u32::from_be_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]) as usize;

        // 'acTL' must come before 'IDAT'
        match &chunk[4..8] {
            b"acTL" => return true,
            b"IDAT" => return false,
            _       => {}
        }

        if let Some(next) = offset
            .checked_add(length)
            .and_then(|n| n.checked_add(12)) {
            offset = next;
        } else { break }
    }

    false
}

pub fn is_animated_image(bytes: &[u8]) -> bool {
    is_animated_webp(bytes) || is_animated_png(bytes)
}

#[cfg(all(target_os = "macos", feature = "old-safari"))]
const EXTENSION: &str = "png";
#[cfg(not(all(target_os = "macos", feature = "old-safari")))]
const EXTENSION: &str = "webp";

#[tauri::command]
pub async fn resize_image(
    image_path: String,
    to_width: u32,
    to_height: u32,
    to_directory: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let input_path = Path::new(&image_path);
        let bytes = std::fs::read(&input_path).map_err(|error| error.to_string())?;

        if is_animated_image(&bytes) {
            return Err("Cannot resize an animated image".to_string());
        }

        let hash = hash_bytes::<Sha1>(&bytes);
        let file_name = &hash[..16];
        let output_path = Path::new(&to_directory)
            .join(format!("{file_name}_{to_width}x{to_height}.{EXTENSION}"));

        if !output_path.exists() {
            let resizing = image::load_from_memory(&bytes).map_err(|error| error.to_string())?;

            resizing
                .resize_to_fill(to_width, to_height, FilterType::Lanczos3)
                .save(&output_path)
                .map_err(|error| error.to_string())?;
        }

        Ok(output_path.to_string_lossy().into_owned())
    }).await.map_err(|error| error.to_string())?
}
