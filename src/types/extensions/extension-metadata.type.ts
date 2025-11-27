export type ExtensionMetadataType = {
  // Should be unique
  "id"        : string;
  "logo"      : string;
  "name"      : string;
  "source"    : string;
  "version"   : string;
  "authors"   : Array<string>;
  // Use ISO 639-1 two-letter language codes
  "languages" : Array<string>;
  "categories": Array<string>;
} & Partial<{
  "description": string;
  "enabled"    : boolean;
}>;