import General from "@/lib/general";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function extractNativeArchives({
  necessaries,
  paths,
}: {
  "necessaries": PreLaunchInformationType;
  "paths"      : Array<string>;
}): Promise<void> {
  const { directories } = necessaries;
  console.log("uhee", paths);

  await Promise.all(
    paths.map(path => General.unzip({
      "from": path,
      "to"  : directories.natives,
    })),
  );
}
