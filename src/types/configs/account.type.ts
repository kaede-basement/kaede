export type AccountType = {
  "msa": {
    "token"       : string;
    "refreshToken": string;
  } | null;
  "profile": {
    "uuid": string;
    "name": string;
    "type": "msa" | "offline";
  };
  "skin": {
    "id"     : string;
    "data"   : string;
    "url"    : string;
    "variant": "classic" | "slim";
  };
};