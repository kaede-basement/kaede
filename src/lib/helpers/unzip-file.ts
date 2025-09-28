import { createReadStream, createWriteStream } from "node:fs";
import unzipper from "unzipper";

export async function unzipFile(input: string, output: string) {
  createReadStream(input)
    .pipe(unzipper.Parse())
    .on("entry", entry => {
      const fileName = entry.path;

      if (fileName.startsWith("META-INF/")) {
        entry.autodrain();
      } else {
        entry.pipe(createWriteStream(`${output}/${fileName}`));
      }
    });
}
