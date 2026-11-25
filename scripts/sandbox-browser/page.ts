import "ses";

import { createSafeDocument } from "ark-of-atrahasis";

import { abandonedFetchContract, fetchContract } from "./fetch-contract.ts";
import { formEventContract } from "./form-events.ts";
import { artifact, type Hooks, launcherContract, runSandbox, sandbox } from "./launcher.ts";
import { lifecycleContract } from "./lifecycle-contract.ts";
import { rootContract } from "./root-contract.ts";

const mount = document.getElementById("__extension-loader__wrapper")!;

const paint = (): Promise<void> => new Promise(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});
const sandboxWorkload = (count: number): string => `(() => {
  const gui = scopedThis["ui::interactivity"]("app");
  const root = gui.getElement("app");
  if (gui.getElement("launcher") !== null) throw Error("Foreign launcher node visible");
  const container = gui.createSection();
  const input = gui.createInput();
  input.setId("focus");
  const rows = [];
  root.appendChild(container);
  container.appendChild(input);
  input.onInput(() => rows[0].setText(input.getValue()));
  return {
    enable() {
      for (let i = 0; i < ${count}; i++) {
        const row = gui.createDiv();
        row.setText(String(i));
        row.setClass("row");
        container.appendChild(row);
        rows.push(row);
      }
      container.setData("phase", "created");
    },
    disable() {
      for (let i = 0; i < 500; i++) {
        const row = rows[i * 20];
        row.setText("updated");
        row.setData("index", String(i));
        row.style.color = "red";
      }
      container.setData("phase", "updated");
    },
    afterDisable() { container.remove(); }
  };
})()`;

function direct(count: number): Hooks {
  const frame = document.createElement("iframe");

  frame.sandbox.add("allow-same-origin");
  mount.append(frame);
  const document_ = frame.contentDocument!;
  const container = document_.createElement("section");
  const input = document_.createElement("input");
  const rows: HTMLElement[] = [];

  input.id = "focus";
  input.addEventListener("input", () => {
    rows[0].textContent = input.value;
  });
  container.append(input);
  document_.body.append(container);

  return {
    enable(): void {
      for (let index = 0; index < count; index++) {
        const row = document_.createElement("div");

        row.textContent = String(index);
        row.className = "row";
        container.append(row);
        rows.push(row);
      }
      container.dataset.phase = "created";
    },
    disable(): void {
      for (let index = 0; index < 500; index++) {
        const row = rows[index * 20];

        row.textContent = "updated";
        row.dataset.index = String(index);
        row.style.color = "red";
      }
      container.dataset.phase = "updated";
    },
    afterDisable(): void {
      container.remove();
    },
    dispose(): void {
      frame.remove();
    },
  };
}

type Timing = { "commit": number; "frame": number };

async function finishTiming(start: number): Promise<Timing> {
  const commit = performance.now() - start;

  await paint();

  return { commit, "frame": performance.now() - start };
}

async function measureMutation(
  target: Element, options: MutationObserverInit, mutate: () => void | Promise<void>,
): Promise<Timing> {
  let observer!: MutationObserver;
  let watchdog!: ReturnType<typeof setTimeout>;
  let start: number;
  const sample = new Promise<Timing>((resolve, reject) => {
    observer = new MutationObserver(() => resolve(finishTiming(start)));
    observer.observe(target, options);
    watchdog = setTimeout(() => reject(new Error("Missing benchmark mutation")), 10_000);
  });

  try {
    start = performance.now();
    const [timing] = await Promise.all([sample, mutate()]);

    return timing;
  } finally {
    observer.disconnect();
    clearTimeout(watchdog);
  }
}

function createdRows(frameDocument: Document, count: number): NodeListOf<HTMLElement> {
  const rows = frameDocument.querySelectorAll<HTMLElement>("section > .row");

  if (rows.length !== count) throw new Error("Missing rows");
  for (const [index, row] of rows.entries()) {
    if (row.textContent !== String(index)) throw new Error("Wrong initial row " + index);
  }

  return rows;
}

async function measure(mode: string, cycle: boolean): Promise<Record<string, number>> {
  const count = cycle ? 1000 : 10_000;
  const extension = mode === "direct" ? undefined : await artifact(sandboxWorkload(count));
  let start = performance.now();
  const api = extension ? await runSandbox(mode, extension) : direct(count);
  const document_ = (mount.firstElementChild as HTMLIFrameElement).contentDocument!;

  if (cycle) {
    try {
      await api.enable();
      const verification = performance.now();

      createdRows(document_, count);
      start += performance.now() - verification;
      await api.afterDisable();
    } finally {
      api.dispose();
    }
    const timing = await finishTiming(start);

    if (document_.querySelector(".row, #focus") || mount.childElementCount) {
      throw new Error("UI retained after disposal");
    }

    return { "cycleCommit": timing.commit, "cycleFrame": timing.frame };
  }

  try {
    const container = document_.querySelector("section")!;
    const phase = { "attributeFilter": ["data-phase"] };
    const created = await measureMutation(container, phase, api.enable);

    const rows = createdRows(document_, count);
    const updated = await measureMutation(container, phase, api.disable);

    if (document_.querySelectorAll("[data-index]").length !== 500) {
      throw new Error("Missing updates");
    }
    for (let index = 0; index < 500; index++) {
      const row = rows[index * 20];

      if (row.dataset.index !== String(index) || row.textContent !== "updated" ||
        row.style.color !== "red") {
        throw new Error(`Missing sparse edit at row ${index * 20}`);
      }
    }
    const input = document_.querySelector<HTMLInputElement>("#focus")!;
    const first = rows[0];
    const event = new Event("input", { "bubbles": true });

    input.focus();
    input.value = "typed";
    const changed = await measureMutation(first, { "childList": true }, () => {
      input.dispatchEvent(event);
    });

    if (first.textContent !== "typed") throw new Error("Missing input update");
    await api.afterDisable();
    if (document_.querySelector(".row, #focus")) throw new Error("UI retained after removal");

    return {
      "createdCommit": created.commit, "createdFrame" : created.frame,
      "updatedCommit": updated.commit, "updatedFrame" : updated.frame,
      "eventCommit"  : changed.commit, "eventFrame"   : changed.frame,
    };
  } finally {
    api.dispose();
  }
}

async function contract(): Promise<boolean> {
  const gui = createSafeDocument("launcher");
  const surface = Object.entries(gui).filter(([name]) => name.startsWith("create"))
    .map(
      ([name, factory]) => {
        const input = { "createList": "ordered", "createFormatting": "strong", "createHeading": 2 };
        const argument = input[name as keyof typeof input];
        const wrapper = factory(argument);
        const keys = Object.keys(wrapper).sort();

        wrapper.remove();

        return { name, argument, keys };
      },
    );
  const code = `(() => {
    const gui = scopedThis["ui::interactivity"]("app");
    const factories = ${JSON.stringify(surface)};
    if (Object.keys(gui).length !== factories.length + 1) throw Error("Factory count");
    for (const { name, argument, keys } of factories) {
      const node = gui[name](argument);
      const actual = new Set();
      for (let proto = node; proto; proto = Object.getPrototypeOf(proto)) {
        for (const key of Object.getOwnPropertyNames(proto)) actual.add(key);
      }
      if ([...actual].sort().join() !== keys.join()) throw Error("Ark surface: " + name);
      node.remove();
    }
    const parent = gui.createSection();
    const button = gui.createButton();
    parent.appendChild(button);
    gui.getElement("app").appendChild(parent);
    button.addEventListener("click", event => {
      try { event.preventDefault(); } catch (error) { button.setText(error.message); }
    }, { preventDefault: true, stopPropagation: true });
    return { afterDisable() { parent.remove(); } };
  })()`;
  const api = await sandbox("worker", code);

  try {
    const document_ = mount.querySelector("iframe")!.contentDocument!;
    const button = document_.querySelector("button")!;

    let bubbled = false;

    document_.body.addEventListener("click", () => {
      bubbled = true;
    });
    const event = new Event("click", { "bubbles": true, "cancelable": true });

    button.dispatchEvent(event);
    await paint();
    if (!event.defaultPrevented || bubbled || !button.textContent?.includes("declarative")) {
      throw new Error("Worker cancellation contract");
    }
    await api.afterDisable();
    api.dispose();

    return !document_.querySelector("button") && document.adoptNode(button).dispatchEvent(
      new Event("click", { "bubbles": true, "cancelable": true }),
    );
  } finally {
    api.dispose();
  }
}

Object.assign(window, {
  abandonedFetchContract,
  fetchContract, rootContract, formEventContract, measure, contract, launcherContract,
  lifecycleContract,
});
