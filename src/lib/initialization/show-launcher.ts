import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

let markShown: () => void;

export const LauncherShown = new Promise<void>(resolve => {
  markShown = resolve;
});

export async function showLauncher(): Promise<void> {
  await getCurrentWebviewWindow().show();
  markShown();
}
