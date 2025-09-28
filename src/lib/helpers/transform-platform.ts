import { platform } from "@tauri-apps/plugin-os";

export async function transformPlatform(): Promise<string> {
  switch (platform()) {
    case "windows": { return "windows"; }
    case "linux": { return "linux"; }
    case "macos": { return "osx"; }
    default: { throw new Error(`Unknown platform passed (${platform()})`); }
  }
}