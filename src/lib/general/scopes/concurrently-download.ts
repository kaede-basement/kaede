import Errors from "@/lib/errors";
import { downloadWithProgress } from "@/lib/launcher/scopes/fetching/download-with-progress.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  LauncherStatusesType,
  LaunchStatusType,
} from "@/types/launcher/launch/launch-status.type.ts";

export function concurrentlyDownload({
  concurrency,
  entries,
  statuses,
  statusScope,
}: {
  "concurrency": number;
  "entries"    : Array<{ "url": string; "path": string }>;
  "statuses"   : LauncherStatusesType;
  "statusScope": LaunchStatusType;
}): Promise<Array<void>> {
  const indexReference: { "value": number } = {
    "value": 0,
  };

  log.debug(`Starting to download ${entries.length} objects`);

  return Promise.all(
    Array
      .from({ "length": concurrency })
      .map(async (_, groupIndex: number): Promise<void> => {
        while (true) {
          if (indexReference.value >= entries.length) {
            break;
          }

          const entryOutOfTotal = `${indexReference.value + 1}/${entries.length}`;
          const index = indexReference.value++;
          const { url, path } = entries[index];

          log.debug(
            `Concurrency group ${groupIndex}: downloading (${entryOutOfTotal}) '${url}'`,
          );
          try {
            await downloadWithProgress({
              url,
              path,
              statuses,
              statusScope,
            });
          } catch (error: unknown) {
            log.error(
              `Concurrency group ${groupIndex}:`,
              `could not download the ${entryOutOfTotal} object:`,
              Errors.prettify(error),
            );
          }
        }
      }),
  );
}
