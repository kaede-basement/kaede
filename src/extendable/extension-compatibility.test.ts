import { expect, test } from "bun:test";

import { browserHarness } from "../../scripts/sandbox-browser/run.ts";

test("extensions replace live launcher methods, hooks and registered Vue components", async () => {
  const harness = await browserHarness("extension-api", "checkExtensionAPI");

  try {
    expect(await harness.view.evaluate("checkExtensionAPI()")).toEqual({
      "global"          : true,
      "detected"        : true,
      "url"             : "patched",
      "hookResult"      : false,
      "subscribed"      : true,
      "descriptorResult": "redefined",
      "unsubscribed"    : true,
      "registry"        : true,
      "builtin"         : true,
      "overridden"      : true,
      "restored"        : true,
      "registered"      : true,
    });
  } finally {
    harness.close();
  }
}, 30_000);
