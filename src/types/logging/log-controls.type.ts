export type LogControlsType = {
  "searching": {
    "current"     : string;
    "relative"    : number;
    "absolute"    : number | undefined;
    "currentIndex": number | undefined;
  };
  "setSearchPosition"    : (position: number, absolutePosition: number | undefined) => void;
  "searchLogs"           : (search: string) => Array<number>;
  "scrollToIndex"        : (index: number) => void;
  "selectAllLogs"        : () => void;
  "textSelectionRange"   : [number, number] | undefined;
  "setTextSelectionRange": (range: [number, number] | undefined) => void;
  "logsArray"            : Array<string | [number, string]>;
};
