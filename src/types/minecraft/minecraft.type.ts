import type { Static } from "typebox";

import type { ArgumentSchema } from "@/lib/schemas/scopes/argument.schema.ts";
import type { ArtifactSchema } from "@/lib/schemas/scopes/artifact.schema.ts";
import type { LibraryRuleSchema } from "@/lib/schemas/scopes/library-rule.schema.ts";
import type { VersionManifestSchema } from "@/lib/schemas/scopes/version-manifest.schema.ts";
import type { LibrarySchema } from "@/lib/schemas/scopes/library.schema.ts";

export type ArgumentType = Static<typeof ArgumentSchema>;
export type ArtifactType = Static<typeof ArtifactSchema>;
export type LibraryRuleType = Static<typeof LibraryRuleSchema>;
export type VersionManifestType = Static<typeof VersionManifestSchema>;
export type LibraryType = Static<typeof LibrarySchema>;