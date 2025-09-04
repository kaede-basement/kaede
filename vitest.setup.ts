import { vi } from "vitest";

vi.stubGlobal("window", {
  "__KAEDE__": {
    "hooks": {
      "getConfigFile": {
        "before": async () => {},
      },
      "getDefaultConfig": {
        "before": async () => {},
      },
    },
  },
});
vi.mock("@/lib/handlers/log.ts", async () => {
  return await vi.importActual("@/__mocks__/log.cjs");
});