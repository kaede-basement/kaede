import "@/extendable/global-object.ts";

import { mockIPC } from "@tauri-apps/api/mocks";
import * as dialog from "@tauri-apps/plugin-dialog";
import { expect, mock, spyOn, test } from "bun:test";

import {
  AuthOneTimeFetchContextKey, CloseInstanceContextKey,
  LaunchInstanceContextKey, LaunchStatesContextKey,
} from "@/constants/application.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import * as resolution from "@/lib/auth/scopes/resolve-launch-account.ts";
import Launcher from "@/lib/launcher";
import Processes from "@/lib/processes";
import Watchers from "@/lib/watchers";
import { globalStates } from "@/states/global.ts";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

for (const outcome of ["stopped", "exited", "still running", "stalled Java", "stalled account"]) {
  test("Stop during a cached launch: " + outcome, async () => {
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
    }, [], true);
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

    if (outcome === "stalled Java") {
      const major = GlobalInternals.javaMajor;

      cleanup.defer(() => GlobalInternals.javaMajor = major);
      GlobalInternals.javaMajor = undefined;
      cleanup.use(spyOn(Launcher, "fetchJavaMajor").mockImplementation(async () => {
        entered.resolve();
        await resume.promise;

        return 17;
      }));
    } else if (outcome === "stalled account") {
      cleanup.use(spyOn(resolution, "resolveLaunchAccountOutcome").mockImplementation(async () => {
        entered.resolve();
        await resume.promise;
        throw new Error("late refresh failure");
      }));
    }
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
    if (outcome === "still running") {
      message.mockRejectedValueOnce(new Error("dialog unavailable"));
    }
    const pending = launchInstance("game");

    await entered.promise;
    expect(launches.game.downloads.total).toBe(0);
    const stop = view.root.querySelector<HTMLButtonElement>("[id$=abort-button]")!;

    expect(stop.disabled).toBe(false);
    if (outcome === "stalled Java") {
      ask.mockRejectedValueOnce(new Error("dialog unavailable"));
      stop.click();
      await Bun.sleep(0);
      expect(launches.game.launching).toBe(1);
      expect(view.root.contains(stop)).toBe(true);
      expect(stop.disabled).toBe(false);
    }
    stop.click();
    await Bun.sleep(0);
    if (outcome.startsWith("stalled")) {
      expect(launches.game.current).toBe("general-aborted");
      expect(launches.game.launching).toBe(0);
      await pending;
      resume.resolve();
      await Bun.sleep(0);
      expect(launch).not.toHaveBeenCalled();
      expect(message).not.toHaveBeenCalled();

      return;
    }
    resume.resolve();
    await pending;
    expect(kill).toHaveBeenCalledTimes(1);
    if (outcome === "still running") {
      expect(message.mock.calls[0][0]).toContain("Minecraft is still running");
      expect(launches.game.launching).toBe(2);
      expect(stop.disabled).toBe(false);
      kill.mockRejectedValueOnce(new Error("access denied"));
      stop.click();
      await Bun.sleep(0);
      expect(message.mock.calls[1][0]).toContain("Minecraft is still running");
      expect(launches.game.current).toBe("stop-error");
      expect(stop.disabled).toBe(false);
      stop.click();
      await Bun.sleep(0);
      expect(kill).toHaveBeenCalledTimes(3);
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

const profile = (uuid: string): AccountType => ({
  "profile": { uuid, "type": "offline", "name": uuid }, "msa"    : null,
  "skin"   : { "id": "", "data": "", "url": "", "variant": "classic" },
});

test("removing the launch account during a cached Java probe prevents launch", async () => {
  declareInstanceStates();
  instanceStates.game = { "patchVersions": {} } as InstanceStateType;
  const restore = GlobalInternals.instanceContext;

  using cleanup = new DisposableStack;
  cleanup.defer(() => GlobalInternals.instanceContext = restore);
  mockIPC(() => []);
  using watch = spyOn(Watchers, "watchProcesses").mockResolvedValue(() => {});
  const first = profile("A");
  const second = profile("B");
  const profiles = [first];

  using context = await mountComponent("general/misc/ContextProviders", {}, app => {
    app.provide(AuthOneTimeFetchContextKey, profiles);
  });
  const started = Promise.withResolvers<void>();
  const java = Promise.withResolvers<number>();

  using probe = spyOn(Launcher, "fetchJavaMajor").mockImplementation(() => {
    started.resolve();

    return java.promise;
  });
  using launch = spyOn(Launcher, "handleLaunch");
  using notify = spyOn(dialog, "message").mockResolvedValue("Ok");
  const previous = GlobalInternals.javaMajor;

  cleanup.defer(() => GlobalInternals.javaMajor = previous);
  GlobalInternals.javaMajor = undefined;
  const pending = GlobalInternals.instanceContext!.launchInstance("game");

  await started.promise;
  await Bun.sleep(0);
  profiles.splice(0, 1, second);
  java.resolve(17);
  await pending;
  expect(notify.mock.calls[0][0]).toContain("Select or add an account");
  expect(launch).not.toHaveBeenCalled();
  expect(probe).toHaveBeenCalledTimes(1);
  expect(watch).toHaveBeenCalledTimes(1);
  expect(context.root.textContent).toBe("");
});
