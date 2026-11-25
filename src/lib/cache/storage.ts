import * as fs from "@tauri-apps/plugin-fs";

import { join } from "@/lib/file-manager/path.ts";

export class ValidationError extends Error {}

export class SchemaError extends ValidationError {}

export type Digest = { "kind": "sha1" | "sha256"; "sum": string };
export type Entry = {
  "url"          : string;
  "freshUntil"   : number;
  "lifetime"?    : number;
  "etag"?        : string;
  "lastModified"?: string;
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

function validEntry(entry: Entry): boolean {
  return !!entry && typeof entry.url === "string" && Number.isFinite(entry.freshUntil)
    && Number.isSafeInteger(entry.size) && entry.size >= 0 && validDigest(entry.hash)
    && (entry.lifetime === undefined || (Number.isFinite(entry.lifetime) && entry.lifetime >= 0))
    && validHeader(entry.etag) && validHeader(entry.lastModified);
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

export class CacheIndex {
  private entries?: Promise<Entries>;
  private writer = Promise.resolve();

  constructor(private root: string) {}

  private load(): Promise<Entries> {
    return this.entries ??= readIndex(this.root).catch(error => {
      this.entries = undefined;
      throw error;
    });
  }

  async get(path: string): Promise<Entry | undefined> {
    const entries = await this.load();

    return entries.get(path);
  }

  update(path: string, entry?: Entry): Promise<void> {
    const write = this.writer.then(async () => {
      const entries = await this.load();

      if (!entry && !entries.has(path)) return;
      const next = new Map(entries);

      if (entry) next.set(path, entry);
      else next.delete(path);
      const json = JSON.stringify({ "version": 1, "entries": Object.fromEntries(next) });

      await publish(this.root, "index.json", (new TextEncoder).encode(json));
      this.entries = Promise.resolve(next);
    });

    this.writer = write.catch(() => {});

    return write;
  }
}
