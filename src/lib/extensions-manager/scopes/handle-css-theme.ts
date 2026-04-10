export function handleCssTheme(styles: string): HTMLStyleElement {
  const element = document.createElement("style");

  element.textContent = styles;

  document.head.append(element);

  return element;
}