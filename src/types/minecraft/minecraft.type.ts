import type { Static } from "typebox";

import type { ArgumentSchema } from "@/lib/schemas/scopes/argument.schema.ts";
import type { ArtifactSchema } from "@/lib/schemas/scopes/artifact.schema.ts";
import type { AssetSchema } from "@/lib/schemas/scopes/asset.schema.ts";
import type { AssetIndexSchema } from "@/lib/schemas/scopes/asset-index.schema.ts";
import type { ClassifiersSchema } from "@/lib/schemas/scopes/classifiers.schema.ts";
import type { LibrarySchema } from "@/lib/schemas/scopes/library.schema.ts";
import type { LibraryRuleSchema } from "@/lib/schemas/scopes/library-rule.schema.ts";
import type { LoggingConfigSchema } from "@/lib/schemas/scopes/logging-config.schema.ts";
import type { VersionManifestSchema } from "@/lib/schemas/scopes/version-manifest.schema.ts";
import type { VersionMetaModernSchema } from "@/lib/schemas/scopes/version-meta-modern.schema.ts";

export type ArgumentType = Static<typeof ArgumentSchema>;
export type ArtifactType = Static<typeof ArtifactSchema>;
export type AssetType = Static<typeof AssetSchema>;
export type AssetIndexType = Static<typeof AssetIndexSchema>;
export type ClassifiersType = Static<typeof ClassifiersSchema>;
export type LibraryType = Static<typeof LibrarySchema>;
export type LibraryRuleType = Static<typeof LibraryRuleSchema>;
export type LoggingConfigType = Static<typeof LoggingConfigSchema>;
export type VersionManifestType = Static<typeof VersionManifestSchema>;
export type VersionMetaModernType = Static<typeof VersionMetaModernSchema>;