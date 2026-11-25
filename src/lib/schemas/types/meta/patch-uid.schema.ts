import { Type } from "typebox";

import { PatchUIDs } from "@/constants/patch-uids.ts";

export const PatchUidSchema = Type.Union(
  PatchUIDs.map(uid => Type.Literal(uid)),
);
