export const PageRoutes = {
  Home    : "/",
  Library : "/library",
  About   : "/about",
  Settings: "/settings",

  /*
   * by default, we can change constant objects' properties, so typescript
   * defines this object as { [Key: string]: string }
   * this is why we are using "as const" to tell typescript
   * that this object is readonly and should have explicit keys and values
   */
} as const;
