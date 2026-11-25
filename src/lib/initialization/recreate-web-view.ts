/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { log } from "@/lib/logging/log.ts";

// Each new WebView starts a fresh JS realm, including a fresh counter.
const labelPrefix = crypto.getRandomValues(new Uint32Array(4)).join("-");
let sequence = 0;
let pending = false;
let survivingReplacement: WebviewWindow | undefined;

export async function recreateWebView(): Promise<void> {
  if (pending) {
    return;
  }

  pending = true;

  try {
    if (survivingReplacement) {
      await survivingReplacement.destroy();
      survivingReplacement = undefined;
    }

    const current = getCurrentWebviewWindow();
    const id = `main-${labelPrefix}-${++sequence}`;
    const webview = new WebviewWindow(id, GlobalInternals.webViewRecreation);

    await new Promise<void>((resolve, reject) => {
      webview.once("tauri://created", () => resolve()).catch(reject);
      webview.once("tauri://error", reject).catch(reject);
    });
    try {
      await current.destroy();
    } catch (error) {
      survivingReplacement = webview;
      try {
        await webview.destroy();
        survivingReplacement = undefined;
      } catch (cleanupError) {
        log.warn(__PRE_BUNDLED_FILENAME__, "Replacement cleanup failed:", String(cleanupError));
      }
      throw error;
    }
  } finally {
    pending = false;
  }
}
