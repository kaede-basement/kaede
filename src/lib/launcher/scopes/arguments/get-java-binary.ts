import type { Platform } from "@tauri-apps/plugin-os";

export async function getJavaBinary({
  currentPlatform,
}: {
  "currentPlatform": Platform;
}): Promise<"java" | "cmd"> {
  switch (currentPlatform) {
    case "windows": {
      return "cmd";
    }
    default: {
      return "java";
    }
  }
}
