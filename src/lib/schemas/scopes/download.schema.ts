import Type from "typebox";

import { ArtifactSchema } from "@/lib/schemas/scopes/artifact.schema.ts";
import { ClassifiersSchema } from "@/lib/schemas/scopes/classifiers.schema.ts";

export const DownloadSchema = Type.Object({
  "artifact"   : ArtifactSchema,
  "classifiers": Type.Optional(ClassifiersSchema),
});