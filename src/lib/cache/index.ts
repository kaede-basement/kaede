import { exists, remove, stat } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";

import { join } from "@/lib/file-manager/path.ts";

import {
  CacheIndex,
  type Digest,
  type Entry,
  publish,
  readOptional,
  rejectSymlink,
  SchemaError,
  ValidationError,
  validDigest,
  validPath,
} from "./storage.ts";

type RequestOptions = {
  "baseDirectory"    : string;
  "relativePath"     : string;
  "url"              : string;
  "expectedHash"?    : Digest;
  "expectedSize"?    : number;
  "adoptLegacyPatch"?: boolean;
  "ttl"?             : number;
  "validate"?        : (value: unknown) => boolean;
  "onFetch"?         : () => void;
};

type Document = { "data": unknown; "bytes": Uint8Array<ArrayBuffer>; "hash": Digest };
const indexes = (new Map<string, CacheIndex>);
const pending = (new Map<string, {
  "key"     : string;
  "validate": RequestOptions["validate"];
  "result"  : Promise<Document>;
}>);
const defaultTtl = 7 * 24 * 60 * 60 * 1000;

async function decode(bytes: Uint8Array<ArrayBuffer>, options: RequestOptions, expected?: Digest):
Promise<Document> {
  if (options.expectedSize !== undefined && bytes.length !== options.expectedSize) {
    throw new ValidationError("Unexpected metadata size");
  }
  const kind = expected?.kind ?? "sha256";
  const digest = await crypto.subtle.digest(kind === "sha1" ? "SHA-1" : "SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0"));
  const sum = hex.join("");

  if (expected && sum !== expected.sum) throw new ValidationError("Unexpected metadata digest");
  let data: unknown;

  try {
    data = JSON.parse(new TextDecoder("utf8", { "fatal": true }).decode(bytes));
  } catch (error) {
    throw new SyntaxError("Invalid JSON metadata", { "cause": error });
  }
  if (options.validate && !options.validate(data)) throw new SchemaError("Invalid metadata");

  return { data, bytes, "hash": { kind, sum } };
}

function freshUntil(headers: Headers, ttl: number): number | undefined {
  const control = headers.get("cache-control") ?? "";
  const directives = control.toLowerCase().split(",")
    .map(part => part.trim());

  if (directives.includes("no-store")) return;
  if (directives.some(part => (/^no-cache(?:=|$)/).test(part))) return 0;
  for (const directive of directives) {
    const match = (/^max-age\s*=\s*"?(\d+)"?$/).exec(directive);

    if (match) {
      const seconds = Number(match[1]);

      return seconds === 0 ? 0 : Math.min(Number.MAX_SAFE_INTEGER, Date.now() + (seconds * 1000));
    }
  }
  const expires = Date.parse(headers.get("expires") ?? "");

  return Number.isFinite(expires) ? expires : (ttl === 0 ? 0 : Date.now() + ttl);
}

async function retrieve(options: RequestOptions, root: string): Promise<Document> {
  const { relativePath, expectedHash, url } = options;
  const parts = relativePath.split("/");
  const filename = parts.pop()!;
  let directory = root;

  await rejectSymlink(directory);
  for (const part of parts) {
    directory = join(directory, part);
    await rejectSymlink(directory);
  }
  const path = join(directory, filename);
  const index = indexes.get(root) ?? new CacheIndex(root);

  indexes.set(root, index);
  const stored = await index.get(relativePath);
  const entry = stored?.url === url ? stored : undefined;
  const expected = expectedHash ?? entry?.hash;
  const read = async (): Promise<Document | undefined> => {
    const bytes = await readOptional(path);

    if (!bytes || (!expectedHash && entry && bytes.length !== entry.size)) return;
    try {
      return await decode(bytes, options, expected);
    } catch (error) {
      if (!(error instanceof ValidationError || error instanceof SyntaxError)) throw error;
    }
  };

  if (!stored && !expectedHash && options.adoptLegacyPatch) {
    const local = await read();

    if (local) {
      const info = await stat(path);
      const deadline = (info.mtime?.getTime() ?? 0) + (options.ttl ?? defaultTtl);

      if (deadline > Date.now()) {
        await index.update(relativePath, {
          url, "freshUntil": deadline, "hash": local.hash, "size": local.bytes.length,
        });

        return local;
      }
    }
  }
  const compatible = !entry || !expectedHash ||
    (entry.hash.kind === expectedHash.kind && entry.hash.sum === expectedHash.sum);

  if (compatible && (expectedHash || (entry && Date.now() < entry.freshUntil))) {
    const local = await read();

    if (local) {
      if (!entry && expectedHash) {
        await index.update(relativePath, {
          url, "freshUntil": 0, "hash": expectedHash, "size": local.bytes.length,
        });
      }

      return local;
    }
  }
  const headers = new Headers;

  if (entry && !expectedHash && Date.now() >= entry.freshUntil) {
    if (entry.etag) headers.set("If-None-Match", entry.etag);
    if (entry.lastModified) headers.set("If-Modified-Since", entry.lastModified);
  }
  options.onFetch?.();
  let response = await fetch(url, { headers });
  let local: Document | undefined;

  if (response.status === 304 && entry && (headers.has("If-None-Match")
    || headers.has("If-Modified-Since"))) {
    local = await read();
    if (!local) response = await fetch(url);
  }
  if (!local && !response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  const document = local ?? await decode(new Uint8Array(await response.arrayBuffer()),
    options,
    expectedHash);
  const ttl = local && entry?.freshUntil === 0 ? 0 : options.ttl ?? defaultTtl;
  const deadline = freshUntil(response.headers, ttl);

  if (deadline === undefined) {
    if (await exists(path)) await remove(path);
    await index.update(relativePath);
  } else {
    if (!local) await publish(directory, filename, document.bytes);
    const updated: Entry = {
      url,
      "freshUntil"  : deadline,
      "size"        : document.bytes.length,
      "hash"        : document.hash,
      "etag"        : response.headers.get("etag") ?? (local ? entry?.etag : undefined),
      "lastModified": response.headers.get("last-modified")
        ?? (local ? entry?.lastModified : undefined),
    };

    await index.update(relativePath, updated);
  }

  return document;
}

export async function cachedMetadata(options: RequestOptions): Promise<Document> {
  const { relativePath, expectedHash, expectedSize } = options;

  if (!validPath(relativePath) || (expectedHash !== undefined && !validDigest(expectedHash))
    || (expectedSize !== undefined && (!Number.isSafeInteger(expectedSize) || expectedSize < 0))) {
    throw new ValidationError("Invalid metadata path, digest or size");
  }
  const root = join(options.baseDirectory, "cache");
  const destination = join(root, relativePath).toLowerCase();
  const key = JSON.stringify([
    root,
    relativePath,
    options.url,
    expectedHash?.kind,
    expectedHash?.sum,
    expectedSize,
    options.ttl,
    options.adoptLegacyPatch,
  ]);
  const previous = pending.get(destination);

  if (previous?.key === key && previous.validate === options.validate) return previous.result;
  const start = (): Promise<Document> => retrieve(options, root);
  const result = previous ? previous.result.then(start, start) : start();

  pending.set(destination, { key, "validate": options.validate, result });
  try {
    return await result;
  } finally {
    if (pending.get(destination)?.result === result) pending.delete(destination);
  }
}
