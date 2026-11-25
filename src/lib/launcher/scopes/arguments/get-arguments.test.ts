import { expect, spyOn, test } from "bun:test";

import Hooks from "@/lib/hooks";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

import { getGameArguments } from "./get-game-arguments.ts";
import { getJvmArguments } from "./get-jvm-arguments.ts";

test("removals apply after defaults, metadata and additions", async () => {
  const necessaries = {
    "platform": "linux",
    "instance": {
      "windowHeight": 400, "windowWidth" : 400,
      "add"         : { "jvmArguments": ["added"], "gameArguments": ["added"] },
      "remove"      : {
        "jvmArguments" : ["patch", "added"],
        "gameArguments": ["--width", "400", "added"],
      },
    },
  } as PreLaunchInformationType;
  const finalizedPatch = { "+jvmArgs": ["patch"], "minecraftArguments": "" } as FinalizedPatchType;
  let captured: Array<string> | undefined;

  using hooks = spyOn(Hooks, "catchAsyncResponseHooks").mockImplementation(async options => {
    if (options.scope === "onJVMArgumentsGet" && options.timing === "before") {
      captured = (options.toPass as { "jvmArguments": Array<string> }).jvmArguments;
    }

    return "continue";
  });
  const jvm = await getJvmArguments({ necessaries, finalizedPatch });

  expect(jvm).toBe(captured!);
  expect(hooks).toHaveBeenCalled();
  expect(jvm).not.toContain("patch");
  expect(jvm).not.toContain("added");
  expect(await getGameArguments({ necessaries, finalizedPatch }))
    .toEqual(["--height", "400"]);
});
