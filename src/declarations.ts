declare global {
  interface Window {
    "__KAEDE__": {
      "getConfigFile": {
        "before": () => Promise<void>;
      };
      "getDefaultConfig": {
        "before": () => Promise<void>;
      };
    };
  }
}