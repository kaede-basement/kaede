async function downloadVersionManifest(): Promise<Response> {
  return fetch("https://piston-meta.mojang.com/mc/game/version_manifest.json");
}