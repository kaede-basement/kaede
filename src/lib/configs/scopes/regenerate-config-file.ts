import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { readState } from "@/lib/file-manager/read-state.ts";
import { CheckConfig } from "@/lib/schemas/generated/validators.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function regenerateConfigFile({
  baseDirectory, configFileDirectory,
}: {
  "baseDirectory"      : string;
  "configFileDirectory": string;
}): Promise<ConfigType> {
  const filename = configFileDirectory.split(/[/\\]/).pop()!;

  function validate(value: unknown): { "value": ConfigType; "valid": true } | undefined {
    if (CheckConfig(value)) return { "value": value as ConfigType, "valid": true };
  }

  return readState(
    baseDirectory, filename, undefined, getDefaultConfig, false, validate, configFileDirectory,
  );
}
