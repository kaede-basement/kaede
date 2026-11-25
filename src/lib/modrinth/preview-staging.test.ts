import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, spyOn, test } from "bun:test";
import { effectScope } from "vue";

import { Patches } from "@/constants/meta.ts";
import { Routes } from "@/constants/routes.ts";
import Router from "@/lib/router";
import { declareGlobalStates, globalStates } from "@/states/global.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

import { withTestWindow } from "../../../scripts/setup-tests.ts";
import { ActiveInstall, installMrpack } from "./install-mrpack.ts";

test("preview keeps an install pin across draft replacement", () => withTestWindow(async () => {
  const { "default": browser } = await import("@/lib/browser");
  const { GlobalInternals } = await import("@/extendable/global-internals.ts");
  const { selectArchive, stagingDirectory, watchStaging } = await import("./staging.ts");
  const { resetPageStates } = await import("@/lib/instances/reset-page-states.ts");

  using preview = spyOn(browser, "detectIsBrowser").mockReturnValue(true);
  using initial = spyOn(Router, "getInitialPage").mockReturnValue(Routes.AddInstance);
  declareGlobalStates();
  const scope = effectScope();
  const previousSeparator = GlobalInternals.joinDelimiter;

  GlobalInternals.joinDelimiter = "/";
  const folder = stagingDirectory();
  const paths = ["old", "next"].map(name => folder + "/modrinth-" + name + ".mrpack");
  const saved = new Set(paths);
  const prepared = Promise.withResolvers<void>();
  const page = globalStates.pages["add-instance"];

  mockIPC(async (command, arguments_) => {
    if (command === "prepare_mrpack_install") return prepared.promise;
    if (command === "install_mrpack") throw "Installation cancelled";
    const path = (arguments_ as { "path": string }).path;

    if (command === "plugin:fs|exists") return saved.has(path);
    if (command === "plugin:fs|remove") saved.delete(path);
  });
  const choose = async (path: string): Promise<void> => selectArchive(path, async () => {
    page.importedModpack = { path, "name": "pack", "loader": Patches.FabricLoader };

    return true;
  });

  try {
    scope.run(watchStaging);
    await choose(paths[0]);
    const install = installMrpack({ "archivePath": paths[0], "instanceId" : "id",
      "statuses"   : { "downloads": {} } as LauncherStatusesType });

    await choose(paths[1]);
    page.instance = {
      "name": "pack", "patchVersions": { "net.minecraft": "9" },
    } as InstanceStateType;
    resetPageStates();
    await Bun.sleep(0);
    expect(saved).toEqual(new Set([paths[0]]));
    expect(page.instance.name).not.toBe("pack");
    expect(page.instanceVersionSearch?.patch).toBe(Patches.Minecraft);
    expect(page.importedModpack).toBeUndefined();
    await ActiveInstall.value!.cancel();
    prepared.resolve();
    await expect(install).rejects.toBe("Installation cancelled");
    expect(saved.size).toBe(0);
    expect(preview).toHaveBeenCalled();
    expect(initial).toHaveBeenCalled();
  } finally {
    scope.stop();
    GlobalInternals.joinDelimiter = previousSeparator;
  }
}));
