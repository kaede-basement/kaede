import { expect, mock, test } from "bun:test";

import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

function patch(uid: string, ...dependencies: Array<string>): SpecificPatchMetaType {
  return { uid, "requires": dependencies.map(uid => ({ uid })) } as SpecificPatchMetaType;
}

const dependencies = (new Map<string, SpecificPatchMetaType>);
const resolvePatch = mock(async ({ metadata }: { "metadata": { "uid": string } }) => {
  return dependencies.get(metadata.uid);
});

mock.module("./resolve-patch.ts", () => ({ resolvePatch }));

const { resolveSubPatches } = await import("./resolve-sub-patches.ts");
const necessaries = { "user": {} } as PreLaunchInformationType;

const patchMeta = patch("net.minecraftforge", "net.minecraft", "org.lwjgl");

test("diamond dependencies resolve once and follow both dependents", async () => {
  dependencies.set("net.minecraft", patch("net.minecraft", "net.minecraft.java"));
  dependencies.set("org.lwjgl", patch("org.lwjgl", "net.minecraft.java"));
  dependencies.set("net.minecraft.java", patch("net.minecraft.java"));
  const patches = await resolveSubPatches({ necessaries, patchMeta });

  expect(patches.map(({ uid }) => uid)).toEqual([
    "net.minecraftforge", "net.minecraft", "org.lwjgl", "net.minecraft.java",
  ]);
  expect(resolvePatch).toHaveBeenCalledTimes(3);
});

test("a cycle between sibling branches fails", async () => {
  dependencies.set("net.minecraft", patch("net.minecraft", "org.lwjgl"));
  dependencies.set("org.lwjgl", patch("org.lwjgl", "net.minecraft"));
  await expect(resolveSubPatches({ necessaries, patchMeta }))
    .rejects.toThrow("Cycle");
});
