import PermissionData from "@/constants/permission-data.json";
import { parsePermission } from "@/lib/permissions/parse-permission.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

export const Permissions = {
  "Time": {
    "Performance": "time::performance",
    "Date"       : "time::date",
  },
  "UI": {
    "Basic"        : "ui::basic",
    "Interactivity": "ui::interactivity",
  },
  "Internet": {
    "HTTPGet" : "internet::http-get",
    "HTTPPost": "internet::http-post",
  },
  "Log": {
    "Write": "log::write",
    "Read" : "log::read",
  },
} as const satisfies Record<
  string,
  Record<string, `${string}::${string}`>
>;
export const PermissionsList = Object
  .values(Permissions)
  .flatMap(scope => Object.values(scope));

export const getPermissionDisplayData: (id: string | undefined) => {
  "permission" : string;
  "label"      : string;
  "icon"       : string;
  "description": string;
} = id => {
  if (!id) {
    return {
      "permission" : "",
      "label"      : "do unknown",
      "icon"       : "i-lucide-question-mark",
      "description": "The requested permission is undefined",
    };
  }

  const [base, scope]: Array<string> = id.split("::");
  const requested: string = `${base}::${scope}`;

  if (IsKeyInObject(requested, PermissionData)) {
    const parsed = parsePermission(id);
    const permission = parsed?.base === "internet" ? `${requested}::${parsed.url.href}` : id;

    return { ...PermissionData[requested], permission };
  }

  return {
    "permission" : id,
    "label"      : "do unknown",
    "icon"       : "i-lucide-question-mark",
    "description": "The requested permission does not exist in the list of available permissions",
  };
};

export default {
  Permissions,
  PermissionsList,
  getPermissionDisplayData,
} as const;
