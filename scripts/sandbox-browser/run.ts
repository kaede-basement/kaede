import path from "node:path";

import vue from "@vitejs/plugin-vue";
import { build } from "vite";

export async function browserHarness(
  entryName = "page", readyFunction = "measure",
): Promise<{ "view": Bun.WebView; "close": () => void }> {
  const output = await build({
    "plugins"   : [vue()], "define"    : { "__PRE_BUNDLED_FILENAME__": JSON.stringify("browser") },
    "configFile": false, "logLevel"  : "error",
    "resolve"   : { "alias": { "@": path.resolve("src") } },
    "build"     : {
      "write"          : false, "target"         : "esnext",
      "rolldownOptions": { "input": `scripts/sandbox-browser/${entryName}.ts` },
    },
  });

  if (Array.isArray(output) || !("output" in output)) throw new Error("Expected a single build");
  const files = new Map(output.output.map(file => [
    "/" + file.fileName, file.type === "chunk" ? file.code : file.source,
  ]));
  const entry = output.output.find(file => file.type === "chunk" && file.isEntry)!;
  const html = `<main id="launcher"><div id="__extension-loader__wrapper"></div></main>
    <script type="module" src="/${entry.fileName}"></script>`;
  const server = Bun.serve({
    "hostname": "127.0.0.1", "port": 0,
    fetch(request) {
      const pathname = new URL(request.url).pathname;

      if (pathname === "/") {
        const headers = {
          "Content-Type"           : "text/html",
          "Content-Security-Policy": "script-src 'self' 'unsafe-eval'; worker-src 'self' blob:",
        };

        return new Response(html, { headers });
      }
      if (pathname === "/echo" && request.method === "POST") {
        return new Response(request.body);
      }
      const asset = files.get(pathname);

      return asset
        ? new Response(asset, { "headers": { "Content-Type": "application/javascript" } })
        : new Response(null, { "status": 404 });
    },
  });
  const chrome = Bun.which("google-chrome") ?? Bun.which("chromium") ?? undefined;
  let view: Bun.WebView | undefined;
  const close = (): void => {
    try {
      view?.close();
    } finally {
      server.stop(true);
    }
  };

  try {
    view = new Bun.WebView({ "backend": { "type": "chrome", "path": chrome } });
    await view.navigate(server.url.href);
    if (!await view.evaluate(`typeof window[${JSON.stringify(readyFunction)}] === 'function'`)) {
      throw new Error("Harness failed to load");
    }
  } catch (error) {
    close();
    throw error;
  }

  return { view, close };
}

type Sample = Record<string, number>;

if (import.meta.main) {
  const harness = await browserHarness();

  try {
    for (let round = 0; round < 21; round++) {
      const modes = ["direct", "ses", "worker"];

      for (let index = 0; index < modes.length; index++) {
        const mode = modes[(round + index) % modes.length];
        const results = await harness.view.evaluate<Sample>(`measure("${mode}", false)`);

        await harness.view.cdp("HeapProfiler.collectGarbage");
        const before = await harness.view.cdp<{ "usedSize": number }>("Runtime.getHeapUsage");
        const cycle = await harness.view.evaluate<Sample>(`measure("${mode}", true)`);

        await harness.view.cdp("HeapProfiler.collectGarbage");
        const after = await harness.view.cdp<{ "usedSize": number }>("Runtime.getHeapUsage");

        const heap = after.usedSize - before.usedSize;

        process.stdout.write(JSON.stringify({ round, mode, ...results, ...cycle, heap }) + "\n");
      }
    }
  } finally {
    harness.close();
  }
}
