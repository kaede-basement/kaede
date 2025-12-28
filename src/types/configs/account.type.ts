import type { Static } from "typebox";
import type { Ref } from "vue";

import { AccountSchema } from "@/lib/schemas/scopes/accounts/account.schema.ts";

export type AccountType = Static<typeof AccountSchema>;
export type WrappedAccountsType = Ref<Array<AccountType>, Array<AccountType>>;
