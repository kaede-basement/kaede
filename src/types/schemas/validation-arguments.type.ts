import type { Validator } from "typebox/compile";

export interface ValidationArgumentsType {
  "label": string;
  "info" : {
    "id"   ?: string;
    "index"?: number;
  };
  "value": unknown;
}
export interface FullValidationArgumentsType extends ValidationArgumentsType {
  "schema": Validator;
}
