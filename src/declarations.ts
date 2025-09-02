declare global {
  interface Window {
    "__KAEDE__": {
      "constants": object; // TODO
      "variables": object; // TODO
      "hooks": {
        "getConfigFile": {
          "before": () => Promise<void>;
        };
        "getDefaultConfig": {
          "before": () => Promise<void>;
        };
      };
    };
  }
}