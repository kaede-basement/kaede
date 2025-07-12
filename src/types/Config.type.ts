import { type } from "arktype";

// for arktype
export const ConfigValidation = type({
  __do_not_touch_VERSION: "number",
  customization         : {
    theme           : "string", // TODO
    accent          : "string", // TODO
    customBackground: "string", // TODO
    customTitleBar  : "boolean",
    pageTransitions : "boolean",
    opacity         : {
      sidebar   : "number",
      main      : "number",
      background: "number",
    },
  },
  language             : "string", // TODO
  useSystemLocale      : "boolean",
  minecraftWindowHeight: "number",
  minecraftWindowWidth : "number",
});

/*
 * type inferring works like a shit
 *
 * export type ConfigType = typeof ApplicationConfigValidationType.infer;
 */

// for typescript
export type ConfigType = {
  __do_not_touch_VERSION: number;
  customization: {
    theme           : string; // TODO
    accent          : string; // TODO
    customBackground: string; // TODO
    customTitleBar  : boolean;
    pageTransitions : boolean;
    opacity: {
      sidebar   : number;
      main      : number;
      background: number;
    };
  };
  language             : string; // TODO
  useSystemLocale      : boolean;
  minecraftWindowHeight: number;
  minecraftWindowWidth : number;
};
