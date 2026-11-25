import type { State } from "./ui-tree.ts";

export class WorkerRoots {
  private frame: State = { "id": 0, "wrapper": {}, "children": [] };
  private aliases = new Map<string, State>;

  open(alias: string, create: () => State): State {
    const current = this.aliases.get(alias);

    if (current) return current;
    const root = create();

    root.alias = alias;
    root.hasAliases = true;
    root.parent = this.frame;
    this.frame.children!.push(root);
    this.aliases.set(alias, root);

    return root;
  }

  moved(node: State): void {
    if (!node.hasAliases) return;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (parent === this.frame) return;
      parent.hasAliases = true;
    }

    const detached = [node];

    while (detached.length > 0) {
      const entry = detached.pop()!;

      if (entry.alias !== undefined && this.aliases.get(entry.alias)?.id === entry.id) {
        this.aliases.delete(entry.alias);
      }
      for (const child of entry.children ?? []) {
        if (child.hasAliases) detached.push(child);
      }
    }
  }
}
