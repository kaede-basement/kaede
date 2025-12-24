export type {
  MetaMinecraftType,
  MetaMinecraftEntryType,
  MetaMinecraftVersionType,
} from "@/types/launcher/meta/net-minecraft.type.ts";

export type MetaManifestType = {
  "formatVersion": number;
  "packages"     : Array<{
    "uid"   : string;
    "name"  : string;
    "sha256": string;
  }>;
};
