/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { buildUrlFromBase } from "@/lib/launcher/scopes/parsers/build-url-from-base.ts";
import { checkIsNative } from "@/lib/launcher/scopes/parsers/check-is-native.ts";
import { finalizePatches } from "@/lib/launcher/scopes/parsers/finalize-patches.ts";
import { handlePlatformRule } from "@/lib/launcher/scopes/parsers/handle-platform-rule.ts";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/parsers/normalize-artifact-path.ts";
import { parseLibraries } from "@/lib/launcher/scopes/parsers/parse-libraries.ts";
import { parseLibrary } from "@/lib/launcher/scopes/parsers/parse-library.ts";
import { parseLogging } from "@/lib/launcher/scopes/parsers/parse-logging.ts";
import { parseMainJar } from "@/lib/launcher/scopes/parsers/parse-main-jar.ts";
import { parseNative } from "@/lib/launcher/scopes/parsers/parse-native.ts";
import { shouldIncludeLibrary } from "@/lib/launcher/scopes/parsers/should-include-library.ts";
import { unifyPlatformWithArch } from "@/lib/launcher/scopes/parsers/unify-platform-with-arch.ts";

export default {
  buildUrlFromBase,
  checkIsNative,
  finalizePatches,
  handlePlatformRule,
  normalizeArtifactPath,
  parseLibraries,
  parseLibrary,
  parseLogging,
  parseMainJar,
  parseNative,
  shouldIncludeLibrary,
  unifyPlatformWithArch,
} as const;
