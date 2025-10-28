import { vi } from "vitest";

// Overwrite 'window' object for tests only
vi.stubGlobal("window", {
  "__KAEDE__": {
    "hooks": {
      "getConfigFile": {
        "before": [],
      },
      "getDefaultConfig": {
        "before": [],
      },
    },
  },
});
// Replace 'log' function that accesses Tauri API with a mock
vi.mock("@/lib/handlers/log.ts", async () => {
  return await vi.importActual("@/__mocks__/log.cjs");
});