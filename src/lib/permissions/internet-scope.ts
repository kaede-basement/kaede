export function guardRequestUrl(input: unknown, scopeUrl: URL): string {
  if (typeof input !== "string") {
    throw new TypeError("The input URL for the fetch should be a string");
  }

  const requestUrl = new URL(input);

  if ((scopeUrl.protocol !== "http:" && scopeUrl.protocol !== "https:") ||
    requestUrl.protocol !== scopeUrl.protocol) {
    throw new Error("Requests require an HTTP(S) scope");
  }

  // Let the scope 'https://github.com/safeProfile' not allow 'https://github.com/safeProfileOhNotSoSafe'
  const scopePath: string = scopeUrl.pathname.endsWith("/")
    ? scopeUrl.pathname
    : scopeUrl.pathname + "/";
  const allowedOrigin: boolean = requestUrl.origin === scopeUrl.origin;
  const allowedPath: boolean =
    requestUrl.pathname === scopeUrl.pathname ||
    requestUrl.pathname.startsWith(scopePath);

  if (!allowedOrigin || !allowedPath) {
    throw new Error(`This request (${requestUrl.href}) goes out of your allowed scope`);
  }

  return requestUrl.href;
}
export type Transport = (url: string, options: RequestInit) => Promise<Response>;
export function fetchWithinScope(
  transport: Transport, url: string, scope: URL, options: RequestInit,
): Promise<Response> {
  return transport(guardRequestUrl(url, scope), options);
}

export function validateContentType(contentType: unknown): string {
  if (typeof contentType !== "string") {
    throw new TypeError("The request 'Content-Type' header must be a string");
  }

  const [mediaType, parameter, extra] = contentType.toLowerCase().split(";", 3);

  if (extra !== undefined || (parameter !== undefined && parameter.trim() !== "charset=utf-8")) {
    throw new Error("Only the UTF-8 charset parameter is allowed");
  }
  const type = mediaType.trim();

  switch (type) {
    // 'https://www.iana.org/assignments/media-types/media-types.xhtml'
    case "text/plain":
    case "image/gif":
    case "image/jpeg":
    case "image/png":
    case "video/mpeg":
    case "video/mp4":
    case "video/webm":
    case "application/json":
    case "application/zip":
    case "application/x-www-form-urlencoded":
    case "application/ogg":
    case "audio/mpeg": {
      return parameter === undefined ? type : `${type}; charset=utf-8`;
    }
    default: {
      throw new Error("The provided content type is not allowed");
    }
  }
}
