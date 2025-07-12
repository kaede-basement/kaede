export default async function parseVersions() {
  const response = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json");

  return await response?.json();
}
