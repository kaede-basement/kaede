import { mkdir } from "@tauri-apps/plugin-fs";
import { download } from "@tauri-apps/plugin-upload";

export async function downloadAssetObject({
  shortHashPath,
  url,
  filePath,
}: {
  "shortHashPath": string;
  "url"          : string;
  "filePath"     : string;
}): Promise<void> {
  await mkdir(shortHashPath);
  await download(
    url,
    filePath,
    ({ progressTotal, total }) => {
      console.log(Math.floor(progressTotal / total * 100));
    },
  );
}
