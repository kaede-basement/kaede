import { expect, test } from "bun:test";

import { joinArguments } from "./join-arguments.ts";
import { splitArguments } from "./split-arguments.ts";

test("argument lists survive editing as text", () => {
  const arguments_ = [
    "", "alpha beta", "gamma", "a\"b", "tab\there", "C:\\with spaces\\", String.raw`\"`, "",
  ];

  expect(splitArguments(joinArguments(arguments_))).toEqual(arguments_);
  expect(splitArguments("a  \"b c\"   d")).toEqual(["a", "b c", "d"]);
  expect(splitArguments("")).toEqual([]);
});
