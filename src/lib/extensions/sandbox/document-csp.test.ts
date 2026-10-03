/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import path from "node:path";

import { expect, test } from "bun:test";

type TauriConfigType = { "app"?: { "security"?: { "csp"?: unknown } } };

const TauriConfigPath: string = path.resolve(
  import.meta.dir,
  "../../../../src-tauri/tauri.conf.json",
);

async function readDocumentCsp(): Promise<Map<string, Array<string>>> {
  const config: TauriConfigType = await Bun.file(TauriConfigPath).json();
  const csp: unknown = config.app?.security?.csp;

  if (typeof csp !== "string") {
    throw new TypeError(
      `'app.security.csp' must be a policy string, got: ${JSON.stringify(csp)}`,
    );
  }

  const directives = new Map<string, Array<string>>;

  for (const directive of csp.split(";")) {
    const [name, ...sources] = directive.trim().split(/\s+/);

    if (name) {
      directives.set(name.toLowerCase(), sources);
    }
  }

  return directives;
}

/*
 * Quoted keywords ('self', 'unsafe-eval', hashes, nonces) name no location,
 * except 'strict-dynamic', which lets trusted scripts load from any URL
 */
function getLocationSources(sources: Array<string>): Array<string> {
  return sources.filter(source => (
    !(/^'[^']+'$/).test(source) || source.toLowerCase() === "'strict-dynamic'"
  ));
}

test("script-src has no network source, so a blob-worker plugin cannot import() code", async () => {
  const directives: Map<string, Array<string>> = await readDocumentCsp();
  const scriptSources: Array<string> | undefined = directives.get("script-src");

  expect(scriptSources).toBeDefined();
  expect(getLocationSources(scriptSources ?? [])).toStrictEqual([]);
  expect(getLocationSources(directives.get("script-src-elem") ?? [])).toStrictEqual([]);
});

test("worker-src allows blob: URLs that sandboxed plugin workers start from", async () => {
  const directives: Map<string, Array<string>> = await readDocumentCsp();

  expect(directives.get("worker-src")).toContain("blob:");
});
