import { createCommand } from "@/lib/launcher/scopes/create-command.ts";
import { handleLaunch } from "@/lib/launcher/scopes/handle-launch.ts";
import { spawnMinecraft } from "@/lib/launcher/scopes/spawn-minecraft.ts";

export default {
  "Atomic": {},
  createCommand,
  handleLaunch,
  spawnMinecraft,
} as const;
