import * as core from "@tauri-apps/api/core";
import { mock, spyOn } from "bun:test";

type SaveRequest = { "baseDirectory": string; "contents": string; "createNew": boolean };

export function mockSaveAccounts() {
  const save = mock(async (_request: SaveRequest): Promise<void> => {});
  const original = core.invoke;
  const spy = spyOn(core, "invoke").mockImplementation(async <T>(
    cmd: string, args?: core.InvokeArgs, options?: core.InvokeOptions,
  ): Promise<T> => {
    if (cmd === "save_accounts") {
      await save(args as SaveRequest);

      return undefined as T;
    }

    return original<T>(cmd, args, options);
  });

  return Object.assign(save, { [Symbol.dispose]: () => spy.mockRestore() });
}
