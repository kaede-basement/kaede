import { platform } from "@tauri-apps/plugin-os";

export function transformPlatform(): string {
  switch (platform()) {
    case "windows": { return "windows"; }
    case "linux": { return "linux"; }
    case "macos": { return "osx"; }
    default: { throw new Error(`Unknown platform passed (${platform()})`); }
  }
}