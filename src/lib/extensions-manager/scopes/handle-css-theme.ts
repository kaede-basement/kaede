export function handleCssTheme(styles: string): void {
  const element = document.createElement("style");

  element.textContent = styles;

  document.head.append(element);
}