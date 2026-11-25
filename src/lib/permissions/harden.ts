export function hardenIfAvailable<T>(value: T): T {
  return typeof harden === "function" ? harden(value) : value;
}
