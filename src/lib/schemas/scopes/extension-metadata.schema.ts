import { Type } from "typebox";

export const ExtensionMetadataSchema = Type.Object({
  "id"         : Type.String(),
  "logo"       : Type.String(),
  "name"       : Type.String(),
  "source"     : Type.String(),
  "version"    : Type.String(),
  "authors"    : Type.Array(Type.String()),
  "languages"  : Type.Array(Type.String()),
  "categories" : Type.Array(Type.String()),
  "description": Type.Union([
    Type.Array(Type.String()),
    Type.Undefined(),
  ]),
  "enabled": Type.Union([
    Type.Boolean(),
    Type.Undefined(),
  ]),
});