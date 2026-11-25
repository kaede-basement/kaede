import type { ProcessHandleType } from "@/types/application/server-process.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export type MinecraftMetaType = {
  "instanceId": string;
};

export type MinecraftProcessType = ProcessHandleType<MinecraftMetaType>;

export type MinecraftLaunchPayloadType = {
  "command"    : { "java": string; "arguments": Array<string> };
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
};

export type LaunchResponseType = {
  "success": boolean;
  "process": MinecraftProcessType | undefined;
};