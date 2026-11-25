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

import type { globalStates } from "@/states/global.ts";
import type { LogParsedLineType } from "@/types/logging/log-parsing.type.ts";
import type { LogRenderSegmentType } from "@/types/logging/log-render.type.ts";
import type { LogSearchMatchType } from "@/types/logging/log-searching.type.ts";

type RawToken = {
  "text"    : string;
  "kind"    : LogRenderSegmentType["kind"];
  "rawStart": number;
  "rawEnd"  : number;
};

function fitToWidth(text: string, width: number): string {
  if (text.length <= width) {
    return text.padEnd(width);
  }

  if (width < 3) {
    return ".".repeat(Math.max(0, width));
  }

  return text.slice(0, width - 3) + "...";
}

export function tokenize(
  parsed: LogParsedLineType,
  { partsSize, partsShown }: Pick<typeof globalStates.logs, "partsShown" | "partsSize">,
): Array<RawToken> {
  if (parsed.kind === "plain") {
    if (!partsShown.message) {
      return [];
    }

    return [{
      "text"    : parsed.text,
      "kind"    : "message",
      "rawStart": parsed.offsets.full[0],
      "rawEnd"  : parsed.offsets.full[1],
    }];
  }

  const tokens: Array<RawToken> = [];

  const push = (text: string, rawStart: number, rawEnd: number, kind: RawToken["kind"]): void => {
    if (text.length === 0) {
      return;
    }

    tokens.push({
      text,
      kind,
      rawStart,
      "rawEnd": rawEnd - rawStart > text.length
        ? rawStart + Math.max(0, text.length - 3)
        : rawEnd,
    });
  };

  const offsets = parsed.offsets;

  if (partsShown.time) {
    const compressed: string = fitToWidth(parsed.time, partsSize.time);

    push(compressed, offsets.time[0], offsets.time[1], "time");
  }

  if (partsShown.level) {
    const compressed: string = fitToWidth(parsed.level, partsSize.level);

    push(compressed, offsets.level[0], offsets.level[1], "level");
  }

  if (partsShown.target) {
    const compressed: string = fitToWidth(parsed.target, partsSize.target);

    push(compressed, offsets.target[0], offsets.target[1], "target");
  }

  if (partsShown.message) {
    push(parsed.message, offsets.message[0], offsets.message[1], "message");
  }

  return tokens;
}

export function overlaySearch(
  tokens: Array<RawToken>,
  matches: Array<LogSearchMatchType>,
  currentGlobalIndex: number,
): Array<LogRenderSegmentType> {
  const segments: Array<LogRenderSegmentType> = [];
  const selected = matches.find(match => match.globalIndex === currentGlobalIndex);

  for (const token of tokens) {
    let cursor = 0;
    const emit = (end: number, state: LogRenderSegmentType["state"]): void => {
      if (end > cursor) {
        segments.push({
          "text" : token.text.slice(cursor, end),
          "kind" : token.kind,
          state,
          "index": segments.length,
        });
        cursor = end;
      }
    };
    const emitFound = (end: number): void => {
      if (selected && selected.charStart - token.rawStart < end) {
        emit(Math.min(end, selected.charStart - token.rawStart), "found");
        emit(Math.min(end, selected.charEnd - token.rawStart), "current");
      }

      emit(end, "found");
    };

    let foundEnd = 0;

    for (const match of matches) {
      const start = Math.max(0, match.charStart - token.rawStart);
      const end = Math.min(token.rawEnd, match.charEnd) - token.rawStart;

      if (start >= end) {
        continue;
      }

      if (start > foundEnd) {
        emitFound(foundEnd);
        emit(start, "none");
      }

      foundEnd = Math.max(foundEnd, end);
    }

    emitFound(foundEnd);
    emit(token.text.length, "none");
  }

  return segments;
}
