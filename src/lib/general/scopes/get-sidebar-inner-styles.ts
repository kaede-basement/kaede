export function getSidebarInnerStyles(
  background: string | undefined,
  textColor: string | undefined,
  blur: number | undefined,
): {
  "backgroundColor": string;
  "color"          : string;
  "backdropFilter"?: string;
} {
  const backgroundColor = background ?? "rgb(10, 10, 10)";
  const color = textColor ?? "rgb(255, 255, 255)";

  if (!blur) {
    return { backgroundColor, color };
  }

  return {
    backgroundColor,
    color,
    "backdropFilter": `blur(${blur}px)`,
  };
}
