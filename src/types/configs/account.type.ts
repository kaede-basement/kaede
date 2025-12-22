import type { Static } from "typebox";

import { AccountSchema } from "@/lib/schemas/scopes/accounts/account.schema.ts";

export type AccountType = Static<typeof AccountSchema>;