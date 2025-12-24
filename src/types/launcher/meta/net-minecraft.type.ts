import { type Static } from "typebox";

import { MinecraftVersionSchema } from "@/lib/schemas/scopes/meta/minecraft-version.schema.ts";

export type MetaMinecraftType = {
  "formatVersion": number;
  "uid"          : string;
  "name"         : string;
  "versions"     : Array<MetaMinecraftEntryType>;
};

export type MetaMinecraftEntryType = {
  "recommended": boolean;
  "releaseTime": string;
  "requires"   : Array<{
    "suggests": string;
    "uid"     : string;
  }>;
  "sha256" : string;
  "type"   : "release" | "snapshot" | "experiment" | "old_alpha" | "old_beta" | "old_snapshot";
  "version": string;
};

export type MetaMinecraftVersionType = Static<typeof MinecraftVersionSchema>;
