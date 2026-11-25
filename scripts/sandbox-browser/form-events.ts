import { sandbox } from "./launcher.ts";

export async function formEventContract(): Promise<boolean> {
  const api = await sandbox("worker", `(() => {
    const gui = scopedThis["ui::interactivity"]("app");
    const root = gui.getElement("app");
    const parent = gui.createButton();
    const child = gui.createInput();
    parent.appendChild(child);
    root.appendChild(parent);
    child.onClick(event => {
      event.target.value = "child";
      parent.setValue("child-bubbled");
      box.setChecked(true);
    });
    parent.onClick(event => {
      if (event.target.value !== "child" || event.currentTarget.value !== "child-bubbled" ||
        child.getValue() !== "child") {
        throw Error("Earlier target write lost during bubbling");
      }
      event.target.value = 17;
      event.currentTarget.value = "parent";
      if (event.target.value !== "17" || event.currentTarget.value !== "parent") {
        throw Error("Event value readback");
      }
    });
    const radios = [1, 2].map(() => {
      const radio = gui.createInput();
      radio.setType("radio");
      radio.setName("group");
      root.appendChild(radio);
      return radio;
    });
    const box = gui.createInput();
    box.setType("checkbox");
    root.appendChild(box);
    let firstBoxClick = true;
    box.addEventListener("click", () => {
      if (firstBoxClick && !box.getChecked()) throw Error("Stale checked snapshot");
      firstBoxClick = false;
    }, { preventDefault: true });
    const inserted = [];
    const pending = gui.createDiv();
    for (const parent of [root, pending]) {
      const radio = gui.createInput();
      radio.setType("radio");
      radio.setName("insert");
      radio.setChecked(true);
      parent.appendChild(radio);
      inserted.push(radio);
    }
    root.appendChild(pending);
    const report = gui.createSpan();
    root.appendChild(report);
    return {
      enable() {
        radios[0].addEventListener("click", () => {}, { preventDefault: true });
      },
      disable() {
        if (inserted[0].getChecked() || !inserted[1].getChecked()) {
          throw Error("Inserted radio subtree did not reconcile peers");
        }
        const states = radios.map(radio => radio.getChecked());
        report.setText([child.getValue(), ...states, box.getChecked()].join(","));
      }
    };
  })()`);

  try {
    const frameDocument = document.querySelector("iframe")!.contentDocument!;
    const [child, first, second, box] = frameDocument.querySelectorAll("input");

    child.click();
    box.dispatchEvent(new Event("click", { "cancelable": true }));
    first.click();
    second.click();
    await api.disable();
    const read = (): string | null | undefined => frameDocument.querySelector("span")?.textContent;

    if (read() !== "17,false,true,true") throw new Error("Radio peer did not uncheck");
    await api.enable();
    first.click();
    box.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    await api.disable();
    const report = read();

    if (child.value !== "17" || frameDocument.querySelector("button")?.value !== "parent" ||
      report !== "17,false,true,true" || first.checked || !second.checked || !box.checked) {
      throw new Error("Bubbling target writes, radio peers or click rollback failed: " + report);
    }

    child.value = "typed after commit";
    child.dispatchEvent(new Event("input", { "bubbles": true }));
    await api.disable();

    return read() === "typed after commit,false,true,true";
  } finally {
    api.dispose();
  }
}
