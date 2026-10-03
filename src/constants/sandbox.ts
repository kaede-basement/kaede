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

/**
 * Limits for a single sandboxed plugin. Exceeding any of them terminates the plugin
 */
export const SandboxLimits = {
  // The approximate size of one message that a plugin worker sends to the launcher
  "MessageBytes"      : 8 * 1024 * 1024,
  // The number of live UI nodes created by one plugin
  "UINodes"           : 10_000,
  // The number of UI operations in one batch; the worker splits larger batches
  "UIOperations"      : 10_000,
  // How long the plugin code evaluation or a lifecycle handler may run
  "LifecycleTimeoutMs": 10_000,
} as const;

export default {
  SandboxLimits,
} as const;
