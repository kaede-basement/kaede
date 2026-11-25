import type { SandboxUIDocument } from "@/declarations.ts";

export function registerClick(
  button: ReturnType<SandboxUIDocument["createButton"]>,
  handler: Parameters<typeof button.addEventListener>[1],
): void {
  button.addEventListener("click", handler, {
    "preventDefault": true, "stopPropagation": true, "stopImmediatePropagation": true,
  });
}
