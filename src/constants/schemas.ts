import { z } from "zod";

export const ArtifactSchema = z.object({
  path: z.string().min(1),
  sha1: z.string().length(40),
  size: z.number().int().
    nonnegative(),
  url: z.string().url(),
}).strict();
export type Artifact = z.infer<typeof ArtifactSchema>;

export const ClassifiersSchema = z.object({
  "natives-linux"  : ArtifactSchema.optional(),
  "natives-osx"    : ArtifactSchema.optional(),
  "natives-windows": ArtifactSchema.optional(),
}).strict();
export type Classifier = z.infer<typeof ClassifiersSchema>;

export const RulesSchema = z.object({
  action: z.enum(["allow", "disallow"]),
  os    : z.object({
    name: z.enum(["osx", "windows", "linux"]),
  }).optional(),
}).strict();
export type Rule = z.infer<typeof RulesSchema>;

export const ExtractSchema = z.object({
  exclude: z.array(z.string()),
}).strict();

export const LibrarySchema = z.object({
  downloads: z.object({
    artifact   : ArtifactSchema,
    classifiers: ClassifiersSchema.optional(),
  }).strict(),
  name   : z.string(),
  rules  : z.array(RulesSchema).optional(),
  extract: ExtractSchema.optional(),
  natives: z.record(z.enum(["linux", "windows", "osx"]), z.string()).optional(),
}).strict();
export type Library = z.infer<typeof LibrarySchema>;
