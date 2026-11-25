import * as http from "@tauri-apps/plugin-http";
import { spyOn } from "bun:test";

export function stallFetch(started: () => void): ReturnType<typeof spyOn<typeof http, "fetch">> {
  return spyOn(http, "fetch").mockImplementation(async (_url, options) => {
    started();

    return new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("request aborted")));
    });
  });
}
