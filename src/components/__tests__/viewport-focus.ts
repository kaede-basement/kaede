import { expect } from "bun:test";
import { nextTick } from "vue";

import type { mountComponent } from "./mount-component.ts";

export async function checkViewportFocus(
  view: Awaited<ReturnType<typeof mountComponent>>, viewport: HTMLElement,
): Promise<void> {
  const document = viewport.ownerDocument;
  const first = viewport.querySelector("button")!;
  const outside = document.createElement("button");

  document.body.append(outside);
  const scroll = async (offset: number): Promise<void> => {
    viewport.scrollTop = offset;
    viewport.dispatchEvent(new view.browser.Event("scroll") as unknown as Event);
    await nextTick();
  };

  first.focus();
  expect(document.activeElement === first).toBe(true);
  await scroll(1600);
  expect(first.isConnected).toBe(false);
  expect(viewport.contains(document.activeElement)).toBe(true);
  outside.focus();
  await scroll(0);
  expect(document.activeElement === outside).toBe(true);
  outside.remove();
}
