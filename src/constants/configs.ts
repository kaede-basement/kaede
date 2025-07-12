import type { ConfigType } from "~/types/Config.type";

export const InitialAppConfiguration: ConfigType = {
  __do_not_touch_VERSION: 1,
  customization         : {
    theme           : "dark",
    accent          : "rose",
    customBackground: "none",
    customTitleBar  : false,
    pageTransitions : true,
    opacity         : {
      sidebar   : 1,
      main      : 1,
      background: 1,
    },
  },
  language             : "ru",
  useSystemLocale      : false,
  minecraftWindowHeight: 480,
  minecraftWindowWidth : 854,
};
