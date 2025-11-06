import { arch, version } from "@tauri-apps/plugin-os";

import type { Rule } from "../schemas/minecrafts-schemas";
import { transformPlatform } from "./transform-platform";

export async function evaluateRules(rules: Rule[]): Promise<boolean> {
  const platform = transformPlatform();
  const architecture = arch();
  const version_ = version();

  let allow = false;

  for (const rule of rules) {
    const os = rule.os;

    const nameMatch = !os?.name || os.name === platform;
    const archMatch = !os?.arch || os.arch === architecture;
    const versionMatch = !os?.version || new RegExp(os.version).test(version_);

    if (nameMatch && archMatch && versionMatch) {
      allow = rule.action === "allow";
    }
  }

  return allow;
}