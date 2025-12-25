export function getAdditionalStartArguments({
  javaBinary,
}: {
  "javaBinary": "java" | "cmd";
}): string {
  return javaBinary === "cmd" ? "/C javaw" : "";
}
