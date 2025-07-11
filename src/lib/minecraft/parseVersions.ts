export default async function parseVersions() {
  const manifestURL = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
  const response = await fetch(manifestURL);
  const body = await response.json();

  return body;
}
