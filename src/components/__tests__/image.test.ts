import { expect, test } from "bun:test";
import { nextTick, reactive } from "vue";

import { mountComponent } from "./mount-component.ts";

test("broken icons show their accessible fallback and reset on a new source", async () => {
  const properties = reactive({ "src": "bad.png", "alt": "Pack icon", "id": "icon" });

  using view = await mountComponent("general/base/Image", properties);
  const image = view.root.querySelector("img")!;

  expect(image.getAttribute("decoding")).toBe("async");
  image.dispatchEvent(new view.browser.Event("error") as unknown as Event);
  await nextTick();
  expect(view.root.querySelector("[role=\"img\"]")?.getAttribute("aria-label")).toBe("Pack icon");
  expect(view.root.querySelector("#icon-fallback")?.classList)
    .toContain("pointer-events-none");
  properties.src = "second.png";
  await nextTick();
  const second = view.root.querySelector("img")!;

  expect(second.src).toEndWith("second.png");
  second.dispatchEvent(new view.browser.Event("load") as unknown as Event);
  await nextTick();
  expect(second.classList.contains("opacity-100")).toBe(true);
});
