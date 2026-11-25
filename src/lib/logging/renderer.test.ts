import { expect, test } from "bun:test";
import { computed, nextTick, shallowRef } from "vue";

import { useLogSearch } from "@/composables/use-log-search.ts";

import { parseLine } from "./parser.ts";
import { overlaySearch, tokenize } from "./renderer.ts";

const columns = {
  "partsShown": { "time": true, "level": false, "target": false, "message": true },
  "partsSize" : { "time": 2, "level": 5, "target": 5 },
};

test("short truncation markers fit their columns", () => {
  const line = parseLine({ "raw": "12:00 | INFO | launcher | message", "index": 0 });

  for (const width of [0, 1, 2]) {
    const partsSize = { ...columns.partsSize, "time": width };
    const tokens = tokenize(line, { ...columns, partsSize });

    expect(tokens.find(token => token.kind === "time")?.text ?? "").toBe(".".repeat(width));
  }
});

test("literal search highlights each bracket once and preserves selection on append", async () => {
  const list = [{ "raw": "[[[", "index": 0 }, { "raw": "[[", "index": 1 }];
  const lines = shallowRef({ list });
  const { status, utils, matchesByLine } = useLogSearch(computed(() => lines.value));

  status.searching = "[[";
  await nextTick();

  const tokens = tokenize(parseLine(list[0]), columns);
  const segments = overlaySearch(tokens, matchesByLine.value.get(0) ?? [], 0);

  expect(segments.map(segment => [segment.text, segment.state])).toEqual([
    ["[[", "current"], ["[", "none"],
  ]);

  const selected = utils.next();

  list.push({ "raw": "[[A", "index": 2 });
  lines.value = { list };
  await nextTick();
  expect(status.matches.length).toBe(3);
  expect(selected).toBe(status.matches[status.index]);

  status.searching = "[a";
  await nextTick();
  expect(status.matches.map(match => match.lineIndex)).toEqual([2]);

  lines.value = { "list": [{ "raw": "replacement", "index": 0 }] };
  await nextTick();
  expect(status.matches).toHaveLength(0);
});
