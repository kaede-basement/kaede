import { expect } from "bun:test";
import { nextTick } from "vue";

import type { mountComponent } from "./mount-component.ts";

export async function scrollViewport(
  view: Awaited<ReturnType<typeof mountComponent>>, viewport: HTMLElement, offset: number,
): Promise<void> {
  viewport.scrollTop = offset;
  viewport.dispatchEvent(new view.browser.Event("scroll") as unknown as Event);
  await nextTick();
}

export async function checkViewportFocus(
  view: Awaited<ReturnType<typeof mountComponent>>, viewport: HTMLElement, expectedRow: string,
): Promise<void> {
  const document = viewport.ownerDocument;
  const first = viewport.querySelector("button")!;
  const outside = document.createElement("button");

  document.body.append(outside);

  first.focus();
  expect(document.activeElement === first).toBe(true);
  await scrollViewport(view, viewport, 1600);
  expect(first.isConnected).toBe(false);
  expect(viewport.contains(document.activeElement)).toBe(true);
  expect(document.activeElement === viewport.querySelector(expectedRow)).toBe(true);
  expect(viewport.scrollTop).toBe(1600);
  if (viewport.querySelector("[data-index]")) {
    viewport.focus({ "preventScroll": true });
    viewport.dispatchEvent(new view.browser.KeyboardEvent("keydown", {
      "key": "ArrowDown", "bubbles": true,
    }) as unknown as Event);
    await nextTick();
    expect(Number(document.activeElement?.getAttribute("data-index"))).toBe(44);
    expect(viewport.scrollTop).toBe(1600);
  }
  outside.focus();
  await scrollViewport(view, viewport, 0);
  expect(document.activeElement === outside).toBe(true);
  outside.remove();
}
