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
    ["[[", "current"], ["[", "found"],
  ]);

  const selected = utils.goTo(1.5);

  expect([selected?.charStart, selected?.charEnd]).toEqual([1, 3]);
  expect(overlaySearch(tokens, matchesByLine.value.get(0) ?? [], status.index)
    .map(segment => [segment.text, segment.state])).toEqual([["[", "found"], ["[[", "current"]]);

  list.push({ "raw": "[[A", "index": 2 });
  lines.value = { list };
  await nextTick();
  expect(status.matches.length).toBe(4);
  expect(selected).toBe(status.matches[status.index]);

  status.searching = "[a";
  await nextTick();
  expect(status.matches.map(match => match.lineIndex)).toEqual([2]);

  lines.value = { "list": [{ "raw": "replacement", "index": 0 }] };
  await nextTick();
  expect(status.matches).toHaveLength(0);
});

test("truncation dots are outside the searchable source span", () => {
  const line = parseLine({ "raw": "12:00 | INFO | launcher | message", "index": 0 });
  const tokens = tokenize(line, { ...columns, "partsSize": { ...columns.partsSize, "time": 4 } });
  const match = { "lineIndex": 0, "globalIndex": 0, "charStart": 0, "charEnd": 5 };

  expect(overlaySearch(tokens, [match], 0).filter(segment => segment.kind === "time")
    .map(segment => [segment.text, segment.state])).toEqual([["1", "current"], ["...", "none"]]);
});

test("a trim preserves the selected occurrence among identical filtered rows", async () => {
  const source = ["hit", "miss", "hit", "hit"];
  const row = (index: number): { "index": number; "raw": string } => (
    { index, "raw": source[index] }
  );
  const lines = shallowRef({ source, "dropped": 0, "list": [row(0), row(2), row(3)] });
  const { status, utils } = useLogSearch(computed(() => lines.value));

  status.searching = "hit";
  await nextTick();
  utils.goTo(2);
  source.shift();
  lines.value = { source, "dropped": 1, "list": [row(1), row(2)] };
  await nextTick();

  expect(status.index).toBe(1);
});
