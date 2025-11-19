import type { Permissions } from "@/constants/application.ts";

export type PermissionType = (typeof Permissions)[keyof typeof Permissions];