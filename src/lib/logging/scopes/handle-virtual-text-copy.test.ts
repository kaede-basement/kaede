import { expect, mock, test } from "bun:test";

import { handleVirtualTextCopy } from "./handle-virtual-text-copy.ts";

test("copy only reads the text of selected filtered rows in source order", async () => {
  const writeText = mock(async () => {});
  const outside: [number, string] = [1, ""];
  const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  Object.defineProperty(outside, 1, { "get": () => {
    throw new Error("Unselected text read");
  } });
  Object.defineProperty(navigator, "clipboard", { "configurable": true, "value": { writeText } });

  try {
    await handleVirtualTextCopy(false, [7, 3], [outside, [3, "first"], [7, "last"]], () => {});
    expect(writeText).toHaveBeenCalledWith("first\nlast");
    await handleVirtualTextCopy(false, [1, 1], ["", "later"], () => {});
    expect(writeText).toHaveBeenCalledWith("later");
  } finally {
    if (previous) {
      Object.defineProperty(navigator, "clipboard", previous);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  }
});
