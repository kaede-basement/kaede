import { LaunchStatus } from "@/constants/launcher.ts";

export type LaunchStatusType = (typeof LaunchStatus)[keyof typeof LaunchStatus];