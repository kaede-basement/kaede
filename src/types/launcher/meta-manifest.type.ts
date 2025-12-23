import type { Static } from "typebox";

import { MinecraftVersionSchema } from "@/lib/schemas/scopes/meta/minecraft-version.schema.ts";

export type MetaManifestType = {
  "formatVersion": number;
  "packages"     : Array<{
    "uid"   : string;
    "name"  : string;
    "sha256": string;
  }>;
};

export type MetaMinecraftType = {
  "formatVersion": number;
  "uid"          : string;
  "name"         : string;
  "versions"     : Array<MetaMinecraftVersionType>;
};

export type MetaMinecraftVersionType = Static<typeof MinecraftVersionSchema>;
