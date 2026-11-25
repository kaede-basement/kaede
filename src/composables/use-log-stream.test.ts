import type { Channel } from "@tauri-apps/api/core";
import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, test } from "bun:test";
import { type App, createRenderer } from "vue";

import { useLogStream } from "./use-log-stream.ts";

test("a reopened log viewer receives lines after the older stop is delivered", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": { crypto } });
  try {
    const renderer = createRenderer({
      "createComment" : () => ({}),
      "createElement" : () => ({}),
      "createText"    : () => ({}),
      "insert"        : () => {},
      "nextSibling"   : () => null,
      "parentNode"    : () => null,
      "patchProp"     : () => {},
      "remove"        : () => {},
      "setElementText": () => {},
      "setText"       : () => {},
    });
    const starts: Array<number> = [];
    const stops: Array<number> = [];
    const release = Promise.withResolvers<void>();
    let started = Promise.withResolvers<void>();
    let stopped = Promise.withResolvers<void>();
    let next = 0;

    type Subscription = {
      "subscriptionId": number;
      "onEvent"       : Channel<{ "type": "lines"; "data": Array<string> }>;
    };
    let active: Subscription | undefined;

    mockIPC(async (command, payload) => {
      if (command === "next_log_subscription_id") {
        return ++next;
      }
      const subscription = payload as Subscription;

      if (command === "stream_logs") {
        active = subscription;
        starts.push(subscription.subscriptionId);
        started.resolve();
      } else if (command === "stop_log_stream") {
        stops.push(subscription.subscriptionId);
        await release.promise;
        if (active?.subscriptionId === subscription.subscriptionId) {
          active = undefined;
        }
        stopped.resolve();
      }
    });

    let viewer: ReturnType<typeof useLogStream>;
    const mount = (): App => {
      const app = renderer.createApp({
        setup() {
          viewer = useLogStream();

          return (): null => null;
        },
      });

      app.mount({});

      return app;
    };
    const first = mount();

    await started.promise;
    first.unmount();
    started = Promise.withResolvers<void>();
    const replacement = mount();

    await started.promise;
    release.resolve();
    await stopped.promise;
    expect(starts).toEqual([1, 2]);
    expect(stops).toEqual([1]);
    active!.onEvent.onmessage({ "type": "lines", "data": ["new line"] });
    expect(viewer!.lines.value.list).toEqual(["new line"]);
    stopped = Promise.withResolvers<void>();
    replacement.unmount();
    await stopped.promise;
    expect(stops).toEqual([1, 2]);
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "window", previous);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
