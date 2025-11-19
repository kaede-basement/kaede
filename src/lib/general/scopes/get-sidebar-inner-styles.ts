export function getSidebarInnerStyles(
  background: string | null | undefined,
  textColor: string | null | undefined,
  blur: number | null | undefined,
): {
  "background"     : string;
  "color"          : string;
  "backdropFilter"?: string;
} {
  const backgroundOutput = background ?? "rgb(10, 10, 10)";
  const color = textColor ?? "rgb(255, 255, 255)";

  if (!blur) {
    return { "background": backgroundOutput, color };
  }

  return {
    color,
    "background"    : backgroundOutput,
    "backdropFilter": `blur(${blur}px)`,
  };
}
