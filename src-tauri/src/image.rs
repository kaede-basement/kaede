use image::imageops::FilterType;
use sha1::Sha1;
use std::{io::Write, path::Path};

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

    while let Some(chunk) = bytes.get(offset..).and_then(|rest| rest.get(..8)) {
        let length = u32::from_be_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]) as usize;

        // 'acTL' must come before 'IDAT'
        match &chunk[4..8] {
            b"acTL" => return true,
            b"IDAT" => return false,
            _ => {}
        }

        if let Some(next) = offset.checked_add(length).and_then(|n| n.checked_add(12)) {
            offset = next;
        } else {
            break;
        }
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
        let bytes = std::fs::read(input_path).map_err(|error| error.to_string())?;

        if is_animated_image(&bytes) {
            return Err("Cannot resize an animated image".to_string());
        }

        let hash = hash_bytes::<Sha1>(&bytes);
        let file_name = &hash[..16];
        let output_path = Path::new(&to_directory)
            .join(format!("{file_name}_{to_width}x{to_height}_v2.{EXTENSION}"));

        std::fs::create_dir_all(&to_directory).map_err(|e| e.to_string())?;
        if !output_path.try_exists().map_err(|e| e.to_string())? {
            let resizing = image::load_from_memory(&bytes).map_err(|error| error.to_string())?;

            let mut stage = crate::file_system::staging_file(Path::new(&to_directory))
                .map_err(|e| e.to_string())?;
            let format = image::ImageFormat::from_extension(EXTENSION).unwrap();
            resizing
                .resize_to_fill(to_width, to_height, FilterType::Lanczos3)
                .write_to(&mut stage, format)
                .map_err(|error| error.to_string())?;
            stage.flush().map_err(|e| e.to_string())?;
            stage.as_file().sync_all().map_err(|e| e.to_string())?;
            stage.persist(&output_path).map_err(|e| e.to_string())?;
        }

        Ok(output_path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn concurrent_resizes_publish_decodable_images_in_new_directory() {
        let root = tempfile::tempdir().unwrap();
        let input = root.path().join("input.png");
        image::RgbImage::new(64, 64).save(&input).unwrap();
        let output = root.path().join("cache");
        let resize = || {
            resize_image(
                input.display().to_string(),
                40,
                40,
                output.display().to_string(),
            )
        };
        let observe = async {
            let hash = hash_bytes::<Sha1>(&std::fs::read(&input).unwrap());
            let path = output.join(format!("{}_40x40_v2.{EXTENSION}", &hash[..16]));
            loop {
                match tokio::fs::read(&path).await {
                    Ok(bytes) => {
                        assert_eq!(image::load_from_memory(&bytes).unwrap().width(), 40);
                        break;
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                        tokio::task::yield_now().await
                    }
                    Err(e) => panic!("{e}"),
                }
            }
        };
        let (first, second, ()) = tokio::time::timeout(std::time::Duration::from_secs(5), async {
            tokio::join!(resize(), resize(), observe)
        })
        .await
        .unwrap();
        assert_eq!(first.unwrap(), second.unwrap());
        assert_eq!(output.read_dir().unwrap().count(), 1);
    }

    #[cfg(not(all(target_os = "macos", feature = "old-safari")))]
    #[tokio::test]
    async fn encoder_failure_discards_staging_file() {
        let root = tempfile::tempdir().unwrap();
        let input = root.path().join("wide.png");
        image::RgbImage::new(16385, 1).save(&input).unwrap();
        let output = root.path().join("cache");
        let result = resize_image(
            input.display().to_string(),
            16385,
            1,
            output.display().to_string(),
        )
        .await;
        assert!(result.is_err());
        assert_eq!(output.read_dir().unwrap().count(), 0);
    }
}
