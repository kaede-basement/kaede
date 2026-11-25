import { expect, spyOn, test } from "bun:test";

import Hooks from "@/lib/hooks";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

import * as resolver from "./resolve-patch.ts";
import { resolveSubPatches } from "./resolve-sub-patches.ts";

function patch(uid: string, ...dependencies: Array<string>): SpecificPatchMetaType {
  return { uid, "requires": dependencies.map(uid => ({ uid })) } as SpecificPatchMetaType;
}

const necessaries = { "user": {} } as PreLaunchInformationType;

const patchMeta = patch("net.minecraftforge", "net.minecraft", "org.lwjgl");

test("diamond dependencies resolve once and follow both dependents", async () => {
  const dependencies = new Map<string, SpecificPatchMetaType>;

  using resolvePatch = spyOn(resolver, "resolveDependency").mockImplementation(
    async ({ metadata }) => dependencies.get(metadata.uid),
  );

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
  const dependencies = new Map<string, SpecificPatchMetaType>;

  using resolvePatch = spyOn(resolver, "resolveDependency").mockImplementation(
    async ({ metadata }) => dependencies.get(metadata.uid),
  );

  dependencies.set("net.minecraft", patch("net.minecraft", "org.lwjgl"));
  dependencies.set("org.lwjgl", patch("org.lwjgl", "net.minecraft"));
  await expect(resolveSubPatches({ necessaries, patchMeta }))
    .rejects.toThrow("Cycle");
  expect(resolvePatch).toHaveBeenCalledTimes(2);
});

test("a later exact constraint replaces a suggestion and drops its obsolete subtree", async () => {
  using resolve = spyOn(resolver, "resolveDependency").mockImplementation(async ({ metadata }) => {
    switch (metadata.uid) {
      case "net.minecraft": {
        return {
          ...patch(metadata.uid),
          "requires": [{ "uid": "net.minecraft.java", "suggests": "8" }],
        };
      }
      case "org.lwjgl": {
        return patch(metadata.uid, "org.lwjgl3");
      }
      case "org.lwjgl3": {
        return {
          ...patch(metadata.uid),
          "requires": [{ "uid": "net.minecraft.java", "equals": "17" }],
        };
      }
      case "net.minecraft.java": {
        const version = metadata.equals ?? metadata.suggests!;

        return { ...patch(metadata.uid, ...(version === "8" ? ["com.azul.java"] : [])), version };
      }
      default: {
        return;
      }
    }
  });

  const result = await resolveSubPatches({ necessaries, patchMeta });

  expect(result[result.length - 1]?.version).toBe("17");
  expect(result.map(({ uid }) => uid)).not.toContain("com.azul.java");
  expect(resolve).toHaveBeenCalled();
});

test("a hook skip keeps siblings and a failed resolution stops the launch", async () => {
  const hooks = Hooks as {
    "catchAsyncResponseHooks": typeof Hooks.catchAsyncResponseHooks<SpecificPatchMetaType | false>;
  };

  using hook = spyOn(hooks, "catchAsyncResponseHooks").mockImplementation(async ({ toPass }) => {
    const { metadata } = toPass as { "metadata": { "uid": string } };

    return metadata.uid === "org.lwjgl" ? false : patch(metadata.uid);
  });

  const patches = await resolveSubPatches({ necessaries, patchMeta });

  expect(patches.map(({ uid }) => uid)).toEqual(["net.minecraftforge", "net.minecraft"]);
  expect(hook).toHaveBeenCalledTimes(2);
  using resolve = spyOn(resolver, "resolveDependency").mockResolvedValue(false);

  await expect(resolveSubPatches({ necessaries, patchMeta })).rejects.toThrow("Failed to resolve");
  expect(resolve).toHaveBeenCalled();
});

test("a suggestion takes precedence over a bare sibling requirement in either order", async () => {
  using resolve = spyOn(resolver, "resolveDependency").mockImplementation(async ({ metadata }) => {
    if (metadata.uid === "net.minecraft.java") {
      return { ...patch(metadata.uid), "version": metadata.suggests ?? "latest" };
    }

    return {
      ...patch(metadata.uid),
      "requires": [{
        "uid"     : "net.minecraft.java",
        "suggests": metadata.uid === "org.lwjgl" ? "17" : undefined,
      }],
    };
  });

  for (const parents of [["net.minecraft", "org.lwjgl"], ["org.lwjgl", "net.minecraft"]]) {
    const root = patch("net.minecraftforge", ...parents);
    const result = await resolveSubPatches({ necessaries, "patchMeta": root });

    expect(result[result.length - 1].version).toBe("17");
  }
  expect(resolve).toHaveBeenCalledTimes(6);
});
