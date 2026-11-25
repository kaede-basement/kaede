import { registerClick } from "@/lib/extensions/sandbox/worker/fixtures/register-click.ts";

import { sandbox } from "./launcher.ts";

const workload = `(() => {
  "use strict";
  const ui = scopedThis["ui::interactivity"];
  const gui = ui("app");
  const root = gui.getElement("app");
  const child = gui.createButton();
  child.setId("launcher");
  const sheet = gui.createStyle();
  const rule = "#launcher { outline-offset: 13px }";
  sheet.setCSS(rule);
  sheet.setCSS("#launcher { background-image: url(https://example.invalid/) }");
  if (sheet.getCSS() !== rule) throw Error("Rejected stylesheet replaced the mirror");
  (${registerClick})(child, event => {
    try { event.target.value = {}; } catch {
      child.setText("retained");
      return;
    }
    throw Error("Invalid event target value accepted");
  });
  child.onClick(() => child.setText("unexpected listener"));
  root.appendChild({});
  root.removeChild({});
  root.insertBefore(child, {});
  root.replaceChild({}, child);
  root.appendChild(child);
  root.setText("replacement");
  root.appendChild(child);
  const link = gui.createAnchor();
  link.setHref("https://example.invalid/");
  root.appendChild(link);
  const group = gui.createDiv();
  root.appendChild(group);
  const nested = ui("nested").getElement("nested");
  group.appendChild(nested);
  group.appendChild(child);
  group.remove();
  root.appendChild(child);
  let conversions = 0;
  const value = { toString() { conversions++; return "hello"; } };
  child.setText(value);
  child.setTitle(value);
  child.setData("coerced", value);
  child.setTabIndex({ valueOf() { return 7; } });
  if (conversions !== 3) throw Error("Unexpected number of conversions");
  let caught = false;
  try { child.setText({ toString() { throw Error("conversion"); } }); }
  catch (error) { caught = error.message === "conversion"; }
  if (!caught || child.getText() !== "hello") throw Error("Failed synchronous coercion");
  const fresh = ui("nested").getElement("nested");
  fresh.setText("fresh");
  root.appendChild(fresh);
  root.setText("detached");
  const current = ui("nested").getElement("nested");
  current.setText("live");
  root.appendChild(fresh);
  if (ui("nested").getElement("nested").getText() !== "live") throw Error("Stale alias won");
  current.remove();
  if (ui("nested").getElement("nested").getText() !== "") throw Error("Stale alias reclaimed");
  const owner = ui("nested").getElement("nested");
  owner.setText("live");
  root.appendChild(owner);
  if (ui("nested").getElement("nested").getText() !== "live") throw Error("Moved alias lost");
  fresh.remove();
  if (ui("nested").getElement("nested").getText() !== "live") throw Error("Removed newer alias");
  owner.remove();
  root.appendChild(link);
  root.appendChild(child);
  ui("nested").getElement("nested").setText("reopened");
  for (const invalid of [
    () => child.setType(42),
    () => gui.createInput().setType(null),
    () => child.appendChild(root),
    () => child.replaceChild(root, child),
    () => gui.createFormatting("script"),
    () => gui.createHeading(9),
    () => gui.createList("wrong"),
    () => { child.style.color = "url(bad)"; },
    () => { child.style.unknown = "1"; }
  ]) {
    let caught = false;
    try { invalid(); } catch { caught = true; }
    if (!caught) throw Error("Invalid Ark call was accepted");
  }
})()`;

export async function rootContract(): Promise<boolean> {
  const launcher = document.getElementById("launcher")!;
  const launcherOffset = getComputedStyle(launcher).outlineOffset;

  for (const mode of ["ses", "worker"]) {
    const api = await sandbox(mode, workload);

    try {
      const frameDocument = document.querySelector("iframe")!.contentDocument!;
      const link = frameDocument.querySelector("a")!;
      const click = new MouseEvent("click", { "bubbles": true, "cancelable": true });

      if (link.dispatchEvent(click)) throw new Error("Frame navigation allowed");
      const button = frameDocument.querySelector("button")!;

      const css = frameDocument.querySelector("style")?.textContent;

      if (button.textContent !== "hello" || button.title !== "hello" ||
        button.dataset.coerced !== "hello" || button.tabIndex !== 7 ||
        css !== "#launcher { outline-offset: 13px }") {
        throw new Error(mode + " lost a retained child, coerced value, or stylesheet");
      }
      if (getComputedStyle(button).outlineOffset !== "13px" ||
        getComputedStyle(launcher).outlineOffset !== launcherOffset) {
        throw new Error(mode + " stylesheet isolation failed");
      }
      if (button.dispatchEvent(new MouseEvent("click", { "bubbles": true, "cancelable": true }))) {
        throw new Error("Declarative cancellation failed");
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(
        () => resolve(),
      )));
      const nested = frameDocument.getElementById("nested");

      if (button.textContent !== "retained" || nested?.textContent !== "reopened") {
        throw new Error("Detached child or reopened alias missing");
      }
    } finally {
      api.dispose();
    }
  }

  return true;
}
