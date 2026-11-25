import { expect, spyOn, test } from "bun:test";

import { createPkcePair } from "./create-pkce-pair.ts";

test("PKCE uses S256 and propagates digest failure", async () => {
  const pair = await createPkcePair();
  const expected = new Bun.CryptoHasher("sha256").update(pair.verifier)
    .digest("base64url");

  expect(pair.challenge).toBe(expected);
  expect(pair.method).toBe("S256");

  using digest = spyOn(crypto.subtle, "digest").mockRejectedValue(new Error("digest failed"));

  await expect(createPkcePair()).rejects.toThrow("digest failed");
  expect(digest).toHaveBeenCalledTimes(1);
});
