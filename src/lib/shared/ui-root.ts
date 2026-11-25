import { createSafeDocument } from "ark-of-atrahasis";

export class ExtensionUI {
  private frame?: HTMLIFrameElement;
  private aliases = new Map<string, { "handle"?: number; "element": HTMLElement }>;
  private names = new WeakMap<HTMLElement, string>;

  constructor(private id: string, private signal: AbortSignal) {
    signal.addEventListener("abort", () => {
      this.frame?.remove();
      this.aliases.clear();
    }, { "once": true });
  }

  private frameDocument(): Document {
    if (this.signal.aborted) throw new Error("Extension UI disposed");
    if (!this.frame) {
      const mount = document.getElementById("__extension-loader__wrapper");

      if (!mount) throw new Error("Extension UI mount unavailable");
      this.frame = document.createElement("iframe");
      this.frame.title = this.id;
      this.frame.style.cssText = "flex: none; max-width: 100%; max-height: 30vh";
      this.frame.sandbox.add("allow-same-origin");
      mount.append(this.frame);
      const frameDocument = this.frame.contentDocument!;

      const { aliases, names } = this;
      const realm = frameDocument.defaultView!;

      realm.customElements.define("kaede-extension-root", class extends realm.HTMLElement {
        disconnectedCallback(): void {
          const name = names.get(this);

          if (!this.isConnected && name !== undefined && aliases.get(name)?.element === this) {
            aliases.delete(name);
          }
        }
      });
      const preventNavigation = (event: Event): void => {
        if (event.composedPath().some(node => (node as Element).localName === "a")) {
          event.preventDefault();
        }
      };

      frameDocument.addEventListener("click", preventNavigation, true);
      frameDocument.addEventListener("auxclick", preventNavigation, true);
    }

    return this.frame.contentDocument!;
  }

  factories(): import("ark-of-atrahasis").SafeDocument {
    return createSafeDocument(this.frameDocument().body);
  }

  document(alias: string, handle?: number): import("ark-of-atrahasis").SafeDocument {
    const frameDocument = this.frameDocument();
    const existing = this.aliases.get(alias);

    if (existing?.element.isConnected && existing.handle === handle) {
      return createSafeDocument(existing.element);
    }
    const root = frameDocument.createElement("kaede-extension-root");
    const gui = createSafeDocument(root);

    root.id = alias;
    root.style.display = "block";
    this.names.set(root, alias);
    this.aliases.set(alias, { handle, "element": root });
    frameDocument.body.append(root);

    return gui;
  }
}
