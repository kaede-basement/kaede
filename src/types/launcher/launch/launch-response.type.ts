import type { ProcessHandleType } from "@/types/application/server-process.type.ts";

export type MinecraftMetaType = {
  "instanceId": string;
};

export type MinecraftProcessType = ProcessHandleType<MinecraftMetaType>;

export type LaunchResponseType = {
  "success" : false;
  "process"?: undefined;
} | {
  "success": true;
  "process": MinecraftProcessType;
};