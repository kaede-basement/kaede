import type { Rule } from "../schemas/minecrafts-schemas";
import { transformPlatform } from "./transform-platform";

export async function parseRules(rules: Rule[]) {
  const platform = await transformPlatform();
  // TODO: Add architecture and version
  const rule = rules.find(rule => (
    rule.os?.name === platform
  ));

  if (rule?.action === "allow") {
    return true;
  }

  return false;
}