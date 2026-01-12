import { createCommand } from "@/lib/launcher/scopes/create-command.ts";
import { handleLaunch } from "@/lib/launcher/scopes/handle-launch.ts";
import { spawnMinecraft } from "@/lib/launcher/scopes/spawn-minecraft.ts";
import { useApplet } from "@/lib/launcher/scopes/use-applet.ts";
import { useShell } from "@/lib/launcher/scopes/use-shell.ts";

export default {
  "Atomic": {
    useApplet,
    useShell,
  },
  createCommand,
  handleLaunch,
  spawnMinecraft,
} as const;
