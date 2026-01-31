import Errors from "@/lib/errors";
import { downloadWithProgress } from "@/lib/launcher/scopes/fetching/download-with-progress.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  LauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";

export function concurrentlyDownload({
  concurrency,
  entries,
  statuses,
  label,
}: {
  "concurrency": number;
  "entries"    : Array<{ "url": string; "path": string }>;
  "statuses"   : LauncherStatusesType;
  "label"      : string;
}): Promise<Array<void>> {
  const logPrefix: string = `${label}:${__PRE_BUNDLED_FILENAME__}`;

  log.debug(logPrefix, `Removing duplicates for ${entries.length} objects`);
  const uniqueMap: Map<string, string> = new Map(
    // It is probably better to filter by unique paths rather than unique URLs...
    entries.map(({ url, path }) => [path, url]),
  );
  const uniqueArtifacts: Array<{ "url": string; "path": string }> = [];

  for (const [path, url] of uniqueMap.entries()) {
    uniqueArtifacts.push({ url, path });
  }

  log.debug(
    logPrefix,
    `Removed ${entries.length - uniqueArtifacts.length}/${entries.length} duplicates`,
  );

  const indexReference: { "value": number } = {
    "value": 0,
  };

  log.debug(
    logPrefix,
    `Starting to download ${uniqueArtifacts.length}/${entries.length} objects`,
  );
  statuses.downloads.total = statuses.downloads.total + uniqueArtifacts.length;

  return Promise.all(
    Array
      .from({ "length": concurrency })
      .map(async (_, groupIndex: number): Promise<void> => {
        while (true) {
          if (indexReference.value >= uniqueArtifacts.length) {
            break;
          }

          const entryOutOfTotal = `${indexReference.value + 1}/${uniqueArtifacts.length}`;
          const index = indexReference.value++;
          const { url, path } = uniqueArtifacts[index];

          log.debug(
            logPrefix,
            `Concurrency group ${groupIndex}: downloading (${entryOutOfTotal}) '${url}'`,
          );
          try {
            await downloadWithProgress({
              url,
              path,
              statuses,
            });
            statuses.downloads.success++;
          } catch (error: unknown) {
            log.error(
              logPrefix,
              `Concurrency group ${groupIndex}:`,
              `could not download the ${entryOutOfTotal} object:`,
              Errors.prettify(error),
            );
            statuses.downloads.failed++;
          }
        }
      }),
  );
}
