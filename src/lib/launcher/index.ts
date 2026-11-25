import { detectJavaInstallations } from "@/lib/launcher/fetching/detect-java-installations.ts";
import { fetchJavaMajor } from "@/lib/launcher/fetching/fetch-java-major.ts";
import Arguments from "@/lib/launcher/scopes/arguments";
import Extractors from "@/lib/launcher/scopes/extractors";
import Fetching from "@/lib/launcher/scopes/fetching";
import { handleLaunch, LaunchCommands } from "@/lib/launcher/scopes/handle-launch.ts";
import Parsers from "@/lib/launcher/scopes/parsers";
import Patches from "@/lib/launcher/scopes/patches";
import Validators from "@/lib/launcher/scopes/validators";

export default Object.assign(LaunchCommands, {
  detectJavaInstallations,
  fetchJavaMajor,
  Arguments,
  Extractors,
  Fetching,
  Parsers,
  Patches,
  Validators,
  handleLaunch,
} as const);
