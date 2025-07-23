export default async function getArch(): Promise<string> {
  const userAgent: string = globalThis.navigator.userAgent.toLowerCase();

  if (userAgent.includes("x86_64") || userAgent.includes("x64")) return "64";
  if (userAgent.includes("aarch64")) return "aarch64";
  if (userAgent.includes("arm64")) return "arm64";
  if (userAgent.includes("i686")) return "ia32";
  if (userAgent.includes("i386")) return "ia32";
  if (userAgent.includes("amd64")) return "64";
  if (userAgent.includes("win32")) return "32";

  return "32"; // fallback
}