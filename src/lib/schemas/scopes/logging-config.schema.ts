import Type from "typebox";

export const LoggingConfigSchema = Type.Object({
  "id"  : Type.String(),
  "sha1": Type.String(),
  "size": Type.Number(),
  "url" : Type.String(),
});