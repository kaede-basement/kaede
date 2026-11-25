import { expect, mock, spyOn, test } from "bun:test";

import { beginLaunch, cancelLaunch, finishLaunch } from "@/states/instance-operation.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

const noop = (): void => {};

test("Stop during command creation prevents the post-download spawn", async () => {
  const id = "cancel-after-downloads";
  const statuses = beginLaunch(id)!;
  const downloaded = mock(async () => true);
  const user = { "account": {} } as PreLaunchInformationType["user"];
  const necessaries = { "directories": { "instance": id }, user, statuses };

  mock.module("@/lib/logging/log.ts", () => ({
    "log": { "info": noop, "templates": { "json": { "contents": noop } } },
  }));
  mock.module("@tauri-apps/plugin-fs", () => ({ "mkdir": noop }));
  mock.module("@/lib/file-manager", () => ({
    "default": { "getBaseDirectory": (): string => "" },
  }));
  mock.module("@/lib/instances", () => ({
    "default": {
      "getMinecraftDirectory": (): { "instanceDirectory": string } => ({ "instanceDirectory": id }),
    },
  }));
  mock.module("@/lib/launcher/scopes/extractors", () => ({
    "default": { "getNecessaries": (): typeof necessaries => necessaries, "unzipNatives": noop },
  }));
  mock.module("@/lib/launcher/scopes/patches", () => ({
    "default": { "resolvePatch": (): object => ({}), "resolveSubPatches": (): never[] => [] },
  }));
  mock.module("@/lib/launcher/scopes/parsers", () => ({
    "default": { "finalizePatches": (): { "artifacts": never[] } => ({ "artifacts": [] }) },
  }));
  mock.module("@/lib/launcher/scopes/fetching", () => ({
    "default": {
      "downloadAssets"   : downloaded, "downloadClient"   : downloaded,
      "downloadLogging"  : downloaded, "downloadLibraries": downloaded,
    },
  }));
  const { handleLaunch, LaunchCommands } = await import("@/lib/launcher/scopes/handle-launch.ts");
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();

  using command = spyOn(LaunchCommands, "createCommand").mockImplementation(async () => {
    entered.resolve();
    await resume.promise;

    return { "java": "java", "arguments": [] };
  });
  using spawn = spyOn(LaunchCommands, "spawnMinecraft").mockResolvedValue({
    "success": true, "process": undefined,
  });
  try {
    const launch = handleLaunch({
      "instanceId"     : id, "instance"       : {} as InstanceStateType, statuses,
      "userPreferences": user, "onInput"        : noop, "onClose"        : noop,
    });

    await entered.promise;
    expect(downloaded).toHaveBeenCalledTimes(4);
    cancelLaunch(statuses);
    resume.resolve();
    expect(await launch).toStrictEqual({ "success": false, "process": undefined });
    expect(command).toHaveBeenCalledTimes(1);
    expect(spawn).not.toHaveBeenCalled();
  } finally {
    resume.resolve();
    finishLaunch(id, statuses);
  }
});
