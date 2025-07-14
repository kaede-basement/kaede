export default async function getPlatform(): Promise<string> {
  const userAgent: string = globalThis.navigator.userAgent.toLowerCase();

  if (userAgent.includes("mac")) return "osx";
  if (userAgent.includes("win")) return "windows";
  if (userAgent.includes("linux")) return "linux";

  return "";
}