export type ConfigType = {
  customization: {
    theme:            string; // TODO
    accent:           string; // TODO
    customBackground: string; // TODO
    customTitleBar:   boolean;
    opacity:          {
      sidebar:    number,
      main:       number,
      background: number,
    },
  },
  language:              string, // TODO
  useSystemLocale:       boolean,
  minecraftWindowHeight: number,
  minecraftWindowWidth:  number,
};
