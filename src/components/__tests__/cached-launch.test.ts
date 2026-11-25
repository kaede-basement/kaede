import "@/extendable/global-object.ts";

import { mockIPC } from "@tauri-apps/api/mocks";
import * as dialog from "@tauri-apps/plugin-dialog";
import { expect, mock, spyOn, test } from "bun:test";

import {
  AuthOneTimeFetchContextKey, CloseInstanceContextKey,
  LaunchInstanceContextKey, LaunchStatesContextKey,
} from "@/constants/application.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Launcher from "@/lib/launcher";
import Processes from "@/lib/processes";
import Watchers from "@/lib/watchers";
import { globalStates } from "@/states/global.ts";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

for (const outcome of ["stopped", "exited", "still running"]) {
  test("Stop during a cached spawn: " + outcome, async () => {
    declareInstanceStates();
    instanceStates.game = { "patchVersions": {} } as InstanceStateType;
    globalStates.selected.currentInstance = "game";
    const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
    const oldContext = GlobalInternals.instanceContext;

    using cleanup = new DisposableStack;
    cleanup.defer(() => {
      GlobalInternals.instanceContext = oldContext;
      if (previous) Object.defineProperty(globalThis, "document", previous);
      else Reflect.deleteProperty(globalThis, "document");
    });
    mockIPC(cmd => (cmd === "list_processes" ? [] : null));
    using watch = spyOn(Watchers, "watchProcesses").mockResolvedValue(() => {});
    using context = await mountComponent("general/misc/ContextProviders", {}, app => {
      app.provide(AuthOneTimeFetchContextKey, [{
        "profile": { "uuid": "u", "type": "offline", "name": "player" }, "msa"    : null,
        "skin"   : { "id": "", "data": "", "url": "", "variant": "classic" },
      }]);
    });
    const { launches, launchInstance, closeInstance } = GlobalInternals.instanceContext!;

    using view = await mountComponent("home/instance/Launch", {}, (app, document) => {
      Object.defineProperty(globalThis, "document", { "configurable": true, "value": document });
      app.provide(LaunchStatesContextKey, launches);
      app.provide(CloseInstanceContextKey, closeInstance);
      app.provide(LaunchInstanceContextKey, launchInstance);
    });
    using launch = spyOn(Launcher, "handleLaunch").mockImplementation(async input => (
      Launcher.spawnMinecraft({
        ...input, "command"    : { "java": "java", "arguments": [] },
        "necessaries": {
          "statuses": input.statuses, "directories": { "instance": "game" },
        } as PreLaunchInformationType,
      })
    ));
    const entered = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const kill = mock(async () => {});

    using spawn = spyOn(Processes, "spawnProcess").mockImplementation(async (options, handlers) => {
      entered.resolve();
      await resume.promise;
      if (outcome !== "stopped") {
        kill.mockImplementationOnce(async () => {
          if (outcome === "exited") {
            handlers?.onExit?.({ "pid": 42, "token": "child", "code": 0, "signal": null });
          }
          throw new Error("kill failed");
        });
      }

      return {
        "pid"  : 42, "token": "child", "kind" : options.kind, "meta" : options.meta,
        kill, "write": async (): Promise<void> => {},
      };
    });
    using ask = spyOn(dialog, "ask").mockResolvedValue(true);
    using message = spyOn(dialog, "message").mockResolvedValue("Ok");
    const pending = launchInstance("game");

    await entered.promise;
    expect(launches.game.downloads.total).toBe(0);
    const stop = view.root.querySelector<HTMLButtonElement>("[id$=abort-button]")!;

    expect(stop.disabled).toBe(false);
    stop.click();
    await Bun.sleep(0);
    resume.resolve();
    await pending;
    expect(kill).toHaveBeenCalledTimes(1);
    if (outcome === "still running") {
      expect(message.mock.calls[0][0]).toContain("Minecraft is still running");
      expect(launches.game.launching).toBe(2);
      expect(stop.disabled).toBe(false);
      stop.click();
      await Bun.sleep(0);
      expect(kill).toHaveBeenCalledTimes(2);
    } else {
      expect(message).not.toHaveBeenCalled();
      expect(launches.game.current).toBe("general-aborted");
    }
    expect(ask).toHaveBeenCalled();
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(watch).toHaveBeenCalledTimes(1);
    expect(context.root.textContent).toBe("");
  });
}
