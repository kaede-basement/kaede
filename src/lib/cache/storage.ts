import * as fs from "@tauri-apps/plugin-fs";

import { join } from "@/lib/file-manager/path.ts";
import { log } from "@/lib/logging/log.ts";

export class ValidationError extends Error {}

export class SchemaError extends ValidationError {}

export type Digest = { "kind": "sha1" | "sha256"; "sum": string };
export type Entry = {
  "url"          : string;
  "freshUntil"   : number;
  "fallbackTtl"? : number;
  "cacheControl"?: string;
  "expires"?     : string;
  "etag"?        : string;
  "lastModified"?: string;
  "lastUsed"?    : number;
  "size"         : number;
  "hash"         : Digest;
};

export function validDigest(value: unknown): value is Digest {
  if (!value || typeof value !== "object" || !("sum" in value) || typeof value.sum !== "string"
    || !("kind" in value)) return false;

  return (value.kind === "sha1" && (/^[a-f0-9]{40}$/).test(value.sum))
    || (value.kind === "sha256" && (/^[a-f0-9]{64}$/).test(value.sum));
}

export function safeComponent(part: string): boolean {
  return typeof part === "string" && part.length > 0 && !(/[<>:"/\\|?*\p{Cc}]/u).test(part)
    && !(/[. ]$/).test(part)
    && !(/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i).test(part);
}

export function validPath(path: string): boolean {
  return typeof path === "string" && path.endsWith(".json") && !(/^index\.json(?:\/|$)/i).test(path)
    && path.split("/").every(part => safeComponent(part));
}

export async function rejectSymlink(path: string): Promise<void> {
  let info: fs.FileInfo;

  try {
    info = await fs.lstat(path);
  } catch (error) {
    if (await fs.exists(path)) throw error;

    return;
  }
  if (info.isSymlink) throw new ValidationError(`Symbolic link in metadata path: ${path}`);
}

export async function readOptional(path: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
  await rejectSymlink(path);
  try {
    return await fs.readFile(path);
  } catch (error) {
    if (await fs.exists(path)) throw error;
  }
}

export async function publish(
  directory: string, filename: string, bytes: Uint8Array,
): Promise<void> {
  await fs.mkdir(directory, { "recursive": true });
  const random = crypto.getRandomValues(new Uint8Array(16));
  const name = Array.from(random, byte => byte.toString(16).padStart(2, "0")).join("");
  const temporary = join(directory, name + ".tmp");

  try {
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, join(directory, filename));
  } catch (error) {
    if (await fs.exists(temporary)) await fs.remove(temporary);
    throw error;
  }
}

type Entries = Map<string, Entry>;

function validHeader(value: unknown): boolean {
  if (value === undefined) return true;

  return typeof value === "string" && (/^[\u0020-\u007E\u00A0-\u00FF]*$/).test(value);
}

export function validator(name: "etag" | "last-modified", value: unknown): string | undefined {
  if (typeof value !== "string" || !validHeader(value)) return;
  if (name === "etag" ? (/^(?:W\/)?"[^"]*"$/).test(value) : Number.isFinite(Date.parse(value))) {
    return value;
  }
}

function validEntry(entry: Entry): boolean {
  return !!entry && typeof entry.url === "string" && Number.isFinite(entry.freshUntil)
    && (entry.lastUsed === undefined || Number.isFinite(entry.lastUsed))
    && Number.isSafeInteger(entry.size) && entry.size >= 0 && validDigest(entry.hash)
    && (entry.fallbackTtl === undefined
      || (Number.isFinite(entry.fallbackTtl) && entry.fallbackTtl >= 0))
    && validHeader(entry.cacheControl) && validHeader(entry.expires)
    && validator("etag", entry.etag) === entry.etag
    && validator("last-modified", entry.lastModified) === entry.lastModified;
}

async function readIndex(root: string): Promise<Entries> {
  const bytes = await readOptional(join(root, "index.json"));

  if (!bytes) return new Map;
  try {
    const index = JSON.parse((new TextDecoder).decode(bytes));

    if (index?.version === 1 && index.entries && typeof index.entries === "object"
      && !Array.isArray(index.entries)) {
      const entries = Object.entries<Entry>(index.entries);

      return new Map(entries.filter(([path, entry]) => validPath(path) && validEntry(entry)));
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }

  return new Map;
}

let enableRetention: () => void;
const retentionReady = new Promise<void>(resolve => {
  enableRetention = resolve;
});

export function enableMetadataRetention(): void {
  enableRetention();
}

export class CacheIndex {
  private entries?: Promise<Entries>;
  private writer = Promise.resolve();

  constructor(
    private root: string,
    private protectedKeys: () => Promise<Set<string> | undefined>,
    private maxEntries = 512,
    private maxBytes = 128 * 1024 * 1024,
  ) {}

  private load(): Promise<Entries> {
    return this.entries ??= readIndex(this.root).then(entries => {
      if (entries.size > 0) {
        void retentionReady.then(() => {
          setTimeout(() => {
            if (!this.overBudget(entries)) return;
            void this.commit().catch(error => {
              log.warn(__PRE_BUNDLED_FILENAME__, "Cannot trim metadata cache", String(error));
            });
          }, 0);
        });
      }

      return entries;
    })
      .catch(error => {
        this.entries = undefined;
        throw error;
      });
  }

  async get(path: string): Promise<Entry | undefined> {
    const entries = await this.load();

    const entry = entries.get(path);

    if (entry) {
      entry.lastUsed = Date.now();
    }

    return entry;
  }

  private overBudget(entries: Entries): boolean {
    let bytes = 0;

    for (const entry of entries.values()) bytes += entry.size;

    return entries.size > this.maxEntries || bytes > this.maxBytes;
  }

  update(path: string, entry?: Entry, publishDocument?: () => Promise<void>): Promise<void> {
    return this.commit(path, entry, publishDocument);
  }

  private commit(
    path?: string, entry?: Entry, publishDocument?: () => Promise<void>,
  ): Promise<void> {
    const locks = globalThis.navigator?.locks;
    const commit = async (): Promise<void> => {
      const local = await this.load();
      const entries = locks ? await readIndex(this.root) : local;

      if (locks) {
        // Include accesses since this window last published, while retaining other windows' writes.
        for (const [key, value] of entries) {
          value.lastUsed = Math.max(value.lastUsed ?? 0, local.get(key)?.lastUsed ?? 0);
        }
      }
      await publishDocument?.();

      if (path !== undefined && !entry && !entries.has(path)) return;
      const next = new Map(entries);

      if (path !== undefined) {
        next.delete(path);
        if (entry) next.set(path, { ...entry, "lastUsed": Date.now() });
      }
      let size = 0;

      for (const value of next.values()) size += value.size;
      if (next.size > this.maxEntries || size > this.maxBytes) {
        const protectedKeys = await this.protectedKeys();

        const oldest = protectedKeys ? [...next] : [];

        oldest.sort((a, b) => (a[1].lastUsed ?? 0) - (b[1].lastUsed ?? 0));

        for (const [key, value] of oldest) {
          if (protectedKeys?.has(key.toLowerCase())) continue;
          let target = this.root;

          for (const part of key.split("/")) {
            await rejectSymlink(target);
            target = join(target, part);
          }
          await rejectSymlink(target);
          if (await fs.exists(target)) await fs.remove(target);
          next.delete(key);
          size -= value.size;
          if (next.size <= this.maxEntries && size <= this.maxBytes) break;
        }
      }
      if (path === undefined && next.size === entries.size) return;
      const json = JSON.stringify({ "version": 1, "entries": Object.fromEntries(next) });

      await publish(this.root, "index.json", (new TextEncoder).encode(json));
      this.entries = Promise.resolve(next);
    };
    const write = this.writer.then(() => (locks
      ? locks.request("kaede-metadata:" + this.root, commit)
      : commit()));

    this.writer = write.catch(() => {});

    return write;
  }
}
