export const FunctionResponses = {
  "Success" : "success",
  "Error"   : "error",
  "Exists"  : "exists",

  /*
   * by default, we can change constant objects' properties, so typescript
   * defines this object as { [Key: string]: string }
   * this is why we are using "as const" to tell typescript
   * that this object is readonly and should have explicit keys and values
   */
} as const;
export const ConfigFilename       = "config.json";

export const Instances_DataFolder = "instances";
export const Assets_DataFolder    = "assets";
export const Libraries_DataFolder = "libraries";

export const Custom_ConfigFolder  = "custom";
