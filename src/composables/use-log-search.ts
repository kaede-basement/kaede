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

import { computed, type ComputedRef, shallowReactive, watch } from "vue";

import type { LogLineType } from "@/types/logging/log-line.type.ts";
import type {
  LogSearchComposableType, LogSearchMatchType, LogSearchStatusType,
} from "@/types/logging/log-searching.type.ts";

type Matcher = ((line: string) => Array<[number, number]>);

const regExpMatcher = (line: string, regex: RegExp): Array<[number, number]> => {
  const results: Array<[number, number]> = [];
  const matches = line.matchAll(regex);

  for (const match of matches) {
    if (match[0].length === 0) {
      // Avoid returning '[0, 0]'
      continue;
    }

    results.push([match.index, match.index + match[0].length]);
  }

  return results;
};

function compileMatcher(raw: string): {
  "matcher": Matcher;
  "valid"  : boolean;
} | undefined {
  if (!raw) {
    return;
  }

  try {
    // Try as regex first
    const regex: RegExp = new RegExp(raw, "gi");

    return {
      "matcher": (line: string) => regExpMatcher(line, regex),
      "valid"  : true,
    };
  } catch {
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const literal = new RegExp(`(?=(${escaped}))`, "gi");

    return {
      "matcher": (line: string) => Array.from(line.matchAll(literal), match => (
        [match.index, match.index + match[1].length]
      )),
      "valid": false,
    };
  }
}

export type SearchRows = {
  "list"    : Array<LogLineType>;
  "source" ?: Array<string>;
  "filter" ?: string;
  "dropped"?: number;
};

export function useLogSearch(
  lines: ComputedRef<SearchRows>,
): LogSearchComposableType {
  const status = shallowReactive<LogSearchStatusType>({
    "searching": "",
    "valid"    : true,
    "active"   : false,
    "index"    : 0,
    "matches"  : [],
  });

  const byLine = shallowReactive(new Map<number, Array<LogSearchMatchType>>);
  const matchesByLine = computed(() => byLine);
  let scanned = 0;
  let compiled: ReturnType<typeof compileMatcher>;

  const querySource = computed(() => status.searching);

  watch([querySource, lines], ([query, source], [previousQuery, previousSource]) => {
    let retainedIndex: number | undefined;
    let retainedStart: number | undefined;

    if (query !== previousQuery || source.list !== previousSource?.list) {
      const selected = status.matches[status.index];

      if (
        selected && query === previousQuery && source.source === previousSource?.source &&
        source.filter === previousSource?.filter && source.dropped !== undefined &&
        previousSource?.dropped !== undefined && source.dropped > previousSource.dropped
      ) {
        retainedIndex = previousSource.list[selected.lineIndex].index
          - (source.dropped - previousSource.dropped);
        retainedStart = selected.charStart;
      }

      compiled = compileMatcher(query);
      scanned = 0;
      status.index = 0;
      status.matches = shallowReactive([]);
      byLine.clear();
      status.active = Boolean(compiled);
      status.valid = compiled?.valid ?? true;
    }

    if (!compiled) {
      return;
    }

    for (; scanned < source.list.length; scanned++) {
      const ranges = compiled.matcher(source.list[scanned].raw);

      if (ranges.length > 0) {
        const matches = ranges.map(([charStart, charEnd]) => {
          const match = {
            "lineIndex": scanned, charStart, charEnd, "globalIndex": status.matches.length,
          };

          if (retainedIndex === source.list[scanned].index && retainedStart === charStart) {
            status.index = match.globalIndex;
          }

          status.matches.push(match);

          return match;
        });

        byLine.set(scanned, matches);
      }
    }
  });

  function goTo(index: number): LogSearchMatchType | undefined {
    if (!Number.isFinite(index) || status.matches.length === 0) {
      return;
    }

    const bounded: number = Math.trunc(index) % status.matches.length;
    const nonNegativeIndex: number = (bounded + status.matches.length) % status.matches.length;

    status.index = nonNegativeIndex;

    return status.matches[nonNegativeIndex];
  }

  function next(): LogSearchMatchType | undefined {
    return goTo(status.index + 1);
  }

  function previous(): LogSearchMatchType | undefined {
    return goTo(status.index - 1);
  }

  function reset(): void {
    status.searching = "";
    status.valid = true;
    status.active = false;
    status.index = 0;
  }

  return {
    status,
    matchesByLine,
    "utils": { goTo, next, previous, reset },
  };
}
