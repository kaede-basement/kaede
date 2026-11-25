import { expect, test } from "bun:test";

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
      "windowHeight": 400, "windowWidth" : 600,
      "add"         : { "jvmArguments": ["added"], "gameArguments": ["added"] },
      "remove"      : { "jvmArguments": ["patch", "added"], "gameArguments": ["added"] },
    },
  } as PreLaunchInformationType;
  const finalizedPatch = { "+jvmArgs": ["patch"], "minecraftArguments": "" } as FinalizedPatchType;
  const jvm = await getJvmArguments({ necessaries, finalizedPatch });

  expect(jvm).not.toContain("patch");
  expect(jvm).not.toContain("added");
  expect(await getGameArguments({ necessaries, finalizedPatch }))
    .toEqual(["--height", "400", "--width", "600"]);
});
