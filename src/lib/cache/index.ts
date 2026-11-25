import { exists, remove } from "@tauri-apps/plugin-fs";

import { join } from "@/lib/file-manager/path.ts";

import { freshness, NetworkError, requestDocument } from "./http.ts";
import {
  CacheIndex,
  type Digest,
  type Entry,
  publish,
  readOptional,
  rejectSymlink,
  SchemaError,
  ValidationError,
  validator,
  validDigest,
  validPath,
} from "./storage.ts";

type RequestOptions = {
  "baseDirectory"       : string;
  "relativePath"        : string;
  "url"                 : string;
  "expectedHash"?       : Digest;
  "expectedSize"?       : number;
  "allowUnindexedPatch"?: boolean;
  "fallbackPath"?       : string;
  "ttl"?                : number;
  "validate"?           : (value: unknown) => boolean;
  "onFetch"?            : () => void;
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
  const read = async (source: string): Promise<Document | undefined> => {
    const bytes = await readOptional(source);

    if (!bytes || (!expectedHash && entry && bytes.length !== entry.size)) return;
    try {
      return await decode(bytes, options, expected);
    } catch (error) {
      if (!(error instanceof ValidationError || error instanceof SyntaxError)) throw error;
    }
  };

  const compatible = entry && (!expectedHash ||
    (entry.hash.kind === expectedHash.kind && entry.hash.sum === expectedHash.sum));

  if (compatible && Date.now() < entry.freshUntil) {
    const local = await read(path);

    if (local) return local;
  }

  const headers = new Headers;

  // Entries written without the original HTTP policy need a full response on expiry.
  if (compatible && entry.fallbackTtl !== undefined && Date.now() >= entry.freshUntil) {
    if (entry.etag) headers.set("If-None-Match", entry.etag);
    if (entry.lastModified) headers.set("If-Modified-Since", entry.lastModified);
  }
  options.onFetch?.();
  let reply: Awaited<ReturnType<typeof requestDocument>>;
  let local: Document | undefined;

  try {
    reply = await requestDocument(url, headers);
    if (reply.response.status === 304 && compatible && (headers.has("If-None-Match")
      || headers.has("If-Modified-Since"))) {
      local = await read(path);
      if (!local) reply = await requestDocument(url);
    }
  } catch (error) {
    if (!(error instanceof NetworkError)) throw error;
    if (expectedHash || entry || (!stored && options.allowUnindexedPatch)) {
      const stale = await read(path);

      if (stale) return stale;
    }
    if (expectedHash && options.fallbackPath) {
      const installed = await read(options.fallbackPath);

      if (installed) return installed;
    }
    throw error;
  }
  const { response, bytes } = reply;

  if (!local && !bytes) throw new Error(`Unexpected HTTP 304 fetching ${url}`);
  const document = local ?? await decode(bytes!, options, expectedHash);
  const fallback = options.ttl ?? (expectedHash ? Number.MAX_SAFE_INTEGER : defaultTtl);
  const previous = local ? entry : undefined;
  const policy = freshness(reply, fallback, previous);

  if (policy) {
    if (!local) await publish(directory, filename, document.bytes);
    const updated: Entry = {
      url,
      ...policy,
      "size"        : document.bytes.length,
      "hash"        : { ...document.hash },
      "etag"        : validator("etag", response.headers.get("etag") ?? previous?.etag),
      "lastModified": validator("last-modified",
        response.headers.get("last-modified") ?? previous?.lastModified),
    };

    await index.update(relativePath, updated);
  } else {
    if (await exists(path)) await remove(path);
    await index.update(relativePath);
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
    options.allowUnindexedPatch,
    options.fallbackPath,
  ]);
  const previous = pending.get(destination);

  if (previous?.key === key && previous.validate === options.validate) {
    const shared = await previous.result;
    const bytes = new Uint8Array(shared.bytes);
    const data = JSON.parse((new TextDecoder).decode(bytes));

    return { bytes, data, "hash": { ...shared.hash } };
  }
  const start = (): Promise<Document> => retrieve(options, root);
  const result = previous ? previous.result.then(start, start) : start();

  pending.set(destination, { key, "validate": options.validate, result });
  try {
    return await result;
  } finally {
    if (pending.get(destination)?.result === result) pending.delete(destination);
  }
}
