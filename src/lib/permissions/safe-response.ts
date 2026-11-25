import { hardenIfAvailable } from "@/lib/permissions/harden.ts";

type RestrictedBlob = {
  "size"       : number;
  "type"       : string;
  "arrayBuffer": () => Promise<ArrayBuffer>;
  "text"       : () => Promise<string>;
  "slice"      : (start?: number, end?: number, contentType?: string) => RestrictedBlob;
};
export type ResponseMetadata = Pick<Response,
  "ok" | "redirected" | "status" | "statusText" | "type" | "url"
> & {
  "headers": [string, string][];
};
export type RestrictedResponse = {
  "headers"    : Pick<Headers, "get" | "has">;
  "json"       : Response["json"];
  "text"       : Response["text"];
  "arrayBuffer": Response["arrayBuffer"];
  "blob"       : () => Promise<RestrictedBlob>;
  "ok"         : boolean;
  "redirected" : boolean;
  "status"     : number;
  "statusText" : string;
  "type"       : Response["type"];
  "url"        : string;
};

function buildSafeBlob(blob: Blob): RestrictedBlob {
  return hardenIfAvailable({
    "size"       : blob.size,
    "type"       : blob.type,
    "arrayBuffer": async () => {
      const buffer: ArrayBuffer = await blob.arrayBuffer();

      return hardenIfAvailable(buffer);
    },
    "text": async () => {
      const text: string = await blob.text();

      return text;
    },
    "slice": (start?: number, end?: number, contentType?: string): RestrictedBlob => {
      return buildSafeBlob(blob.slice(start, end, contentType));
    },
  });
}
const abandoned = typeof FinalizationRegistry === "function"
  ? new FinalizationRegistry<() => void>(release => release()) : undefined;

function trackReader(read: () => Promise<ArrayBuffer>, release?: () => void): typeof read {
  if (!release || !abandoned) return read;
  const consume = (): Promise<ArrayBuffer> => {
    abandoned.unregister(consume);

    return read();
  };

  // Detached body methods, e.g. const read = response.text, also keep this reader alive.
  abandoned.register(consume, release, consume);

  return consume;
}

export function buildSafeResponse(
  metadata: ResponseMetadata, reader: () => Promise<ArrayBuffer>, release?: () => void,
): RestrictedResponse {
  const read = trackReader(reader, release);
  const headers = new Headers(metadata.headers);
  const text = async (): Promise<string> => (new TextDecoder).decode(await read());

  return hardenIfAvailable({
    ...metadata,
    "headers": {
      "get": (name: string) => headers.get(name),
      "has": (name: string) => headers.has(name),
    },
    text,
    "json"       : async () => hardenIfAvailable(JSON.parse(await text())),
    "arrayBuffer": async () => hardenIfAvailable(await read()),
    "blob"       : async () => buildSafeBlob(new Blob([await read()], {
      "type": headers.get("Content-Type") ?? "",
    })),
  });
}
