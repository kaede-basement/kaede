import { BaseDirectory } from "@tauri-apps/api/path";
import { exists, writeFile } from "@tauri-apps/plugin-fs";

export default async function makeHomeDirectory() {
  const configExists = await exists("config.json", {
    baseDir: BaseDirectory.AppConfig,
  });



  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify({
    theme:    "dark",
    accent:   "rose",
    language: "ru",
    javaPath: "",
    proxy:    {
      address: "127.0.0.1",
      pass:    "",
      port:    8080,
      type:    "none",
      user:    "",
    },
    use: {
      systemLocale: true,
    },
    minecraftWindowHeight: 480,
    minecraftWindowWidth:  854,
    showBackground:        true,
  }, null, 2));
  await writeFile("config.json", data, { baseDir: BaseDirectory.AppConfig });
}
