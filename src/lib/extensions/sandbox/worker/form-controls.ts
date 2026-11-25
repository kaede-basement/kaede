import type { CheckedValues, TargetSnapshot } from "./ui-protocol.ts";

function input(element: Element): HTMLInputElement | undefined {
  if (element.localName === "input") return element as HTMLInputElement;
}

export class FormControls {
  private handles = new WeakMap<Element, number>;
  private radioBranches = new WeakSet<Node>;
  private affected = new Set<string>;
  private groups = new Map<string, Set<HTMLInputElement>>;

  register(element: Element, id: number): void {
    if ("value" in element) this.handles.set(element, id);
  }

  group(element: Element, add: boolean): void {
    const radio = input(element);

    if (radio?.type !== "radio" || !radio.name) return;
    const group = this.groups.get(radio.name);

    if (add) {
      this.markBranch(radio);
      if (group) group.add(radio);
      else this.groups.set(radio.name, new Set([radio]));
    } else if (group) {
      group.delete(radio);
      if (group.size === 0) this.groups.delete(radio.name);
    }
  }

  private markBranch(node: Node): void {
    for (let branch: Node | null = node; branch && !this.radioBranches.has(branch);
      branch = branch.parentNode) this.radioBranches.add(branch);
  }

  changed(element: Element): void {
    const radio = input(element);

    if (radio?.type === "radio" && radio.checked && radio.name) this.affected.add(radio.name);
  }

  inserted(element: Element): void {
    if (!this.radioBranches.has(element)) return;
    if (element.parentNode) this.markBranch(element.parentNode);
    this.changed(element);
    if (element.childElementCount) {
      for (const radio of element.querySelectorAll<HTMLInputElement>("input[type=radio]:checked")) {
        if (radio.name) this.affected.add(radio.name);
      }
    }
  }

  reconcile(): CheckedValues {
    const values: CheckedValues = [];

    for (const name of this.affected) {
      for (const peer of this.groups.get(name) ?? []) {
        values.push([this.handles.get(peer)!, peer.checked]);
      }
    }
    this.affected.clear();

    return values;
  }

  forget(element: Element): void {
    this.group(element, false);
    this.handles.delete(element);
  }

  target(element: Element): TargetSnapshot {
    return {
      "id"   : element.id ?? "",
      "value": "value" in element ? element.value : undefined,
      "node" : this.handles.get(element),
    };
  }

  checked(element: Element): CheckedValues | undefined {
    const control = input(element);
    const handle = this.handles.get(element);

    if (handle === undefined || !control ||
      (control.type !== "radio" && control.type !== "checkbox")) {
      return;
    }
    const checked: CheckedValues = [[handle, control.checked]];
    const group = control.type === "radio" && this.groups.get(control.name);

    if (group) {
      const root = control.getRootNode();

      for (const peer of group) {
        if (peer !== control && peer.form === control.form && peer.getRootNode() === root) {
          checked.push([this.handles.get(peer)!, peer.checked]);
        }
      }
    }

    return checked;
  }
}
