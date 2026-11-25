import "@/extendable/global-object.ts";

import { mockIPC } from "@tauri-apps/api/mocks";
import * as dialog from "@tauri-apps/plugin-dialog";
import { expect, mock, spyOn, test } from "bun:test";
import { reactive } from "vue";

import {
  CloseInstanceContextKey, LaunchInstanceContextKey, LaunchStatesContextKey,
} from "@/constants/application.ts";
import { beginLaunchAttempt } from "@/lib/launcher/scopes/fetching/download-outcome.ts";
import { installMrpack } from "@/lib/modrinth/install-mrpack.ts";
import { concurrentlyDownload } from "@/lib/network/concurrently-download.ts";
import { globalStates } from "@/states/global.ts";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

for (const phase of ["prerequisite", "download", "install"]) {
  test("Stop stays inside the error boundary during " + phase, async () => {
    declareInstanceStates();
    instanceStates.game = { "patchVersions": {} } as InstanceStateType;
    globalStates.selected.currentInstance = "game";
    const launches = reactive<Record<string, LauncherStatusesType>>({});

    launches.game = {
      "instanceId": "game", "launching" : 1, "current"   : undefined,
      "downloads" : { "current": new Map, "total": 0, "success": 0, "failed": 0 },
    } as LauncherStatusesType;
    const statuses = launches.game;
    const attempt = beginLaunchAttempt(statuses);
    const finish = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    const cancel = mock(() => {
      throw new Error("IPC failed");
    });

    mockIPC(async command => {
      if (command === "cancel_downloads") return cancel();
      if (command === "prepare_mrpack_install") return;
      started.resolve();
      await finish.promise;

      return { "cancelled": false, "success": 1, "failed": 0, "failures": [] };
    });
    const previous = Object.getOwnPropertyDescriptor(globalThis, "document");

    using cleanup = new DisposableStack;
    cleanup.defer(() => {
      if (previous) Object.defineProperty(globalThis, "document", previous);
      else Reflect.deleteProperty(globalThis, "document");
    });
    using notify = spyOn(dialog, "message").mockResolvedValue("Ok");
    using ask = spyOn(dialog, "ask").mockResolvedValue(true);
    const installing = phase === "install";

    const component = installing ? "add-instance/sections/CreateInstance" : "home/instance/Launch";

    using view = await mountComponent(
      component, {}, (app, document) => {
        Object.defineProperty(globalThis, "document", { "value": document, "configurable": true });
        app.provide(LaunchStatesContextKey, launches);
        app.provide(CloseInstanceContextKey, mock());
        app.provide(LaunchInstanceContextKey, mock());
      }, [], true,
    );
    let work: Promise<unknown> | undefined;

    if (installing) {
      work = installMrpack({ "archivePath": "pack", "instanceId": "game", statuses });
    } else if (phase === "download") {
      work = concurrentlyDownload({
        statuses, "concurrency": 1, "label"      : "client",
        "entries"    : [{ "url": "https://example.org/file", "path": "/game/file" }],
      });
    }
    if (work) await started.promise;
    view.root.querySelector("button")!.click();
    await Bun.sleep(0);
    expect(cancel).toHaveBeenCalledTimes(work ? 1 : 0);
    expect(notify).toHaveBeenCalledTimes(work ? 1 : 0);
    if (work) expect(notify.mock.calls[0][0]).toContain("Could not cancel");
    expect(ask).toHaveBeenCalledTimes(installing ? 0 : 1);
    if (!installing) expect(attempt.signal.aborted).toBe(true);
    expect(view.root.querySelector("button")?.disabled).toBe(false);
    expect(view.root.textContent).not.toContain("Restart required");
    finish.resolve();
    await work;
  });
}
