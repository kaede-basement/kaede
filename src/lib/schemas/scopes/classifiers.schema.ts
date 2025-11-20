import Type from "typebox";

import { ArtifactSchema } from "@/lib/schemas/scopes/artifact.schema.ts";

export const ClassifiersSchema = Type.Object({
  "natives-windows": Type.Optional(ArtifactSchema),
  "natives-linux"  : Type.Optional(ArtifactSchema),
  "natives-osx"    : Type.Optional(ArtifactSchema),
});