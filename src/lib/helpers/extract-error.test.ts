import { expect, test } from "vitest";

import type { DeepRequired } from "@/types/utils/deep-required.type.ts";

import { extractError } from "./extract-error";

const testData: Array<[unknown, DeepRequired<Error>]> = [
  [
    { "days": 8 },
    { "name": "", "message": "", "stack": "" },
  ],
  [
    "",
    { "name": "", "message": "", "stack": "" },
  ],
  [
    1,
    { "name": "", "message": "", "stack": "" },
  ],
  [
    undefined,
    { "name": "", "message": "", "stack": "" },
  ],
  [
    { "name": 3, "message": "lol" },
    { "name": "", "message": "lol", "stack": "" },
  ],
  [
    { "name": "moondrop space travel", "message": 0 },
    { "name": "moondrop space travel", "message": "", "stack": "" },
  ],
  [
    { "name": { "name": "tf is this" }, "message": "" },
    { "name": "", "message": "", "stack": "" },
  ],
  [
    {
      "name"   : "DECO*27",
      "message": "Cherry Pop",
      "stack"  : "bruh i am listening to a different song",
      "trace"  : "whar",
    },
    {
      "name"   : "DECO*27",
      "message": "Cherry Pop",
      "stack"  : "bruh i am listening to a different song",
    },
  ],
];

for (const [input, output] of testData) {
  const testName = `Extract Error: ${JSON.stringify(input)}`;

  test(testName, () => {
    expect(
      JSON.stringify(extractError(input)),
    ).toBe(
      JSON.stringify(output),
    );
  });
}
