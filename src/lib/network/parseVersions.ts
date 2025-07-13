import { URL } from "~/constants/url";

export default async function parseVersions() {
  const response = await fetch(URL.VersionManifest);

  return await response?.json();
}
