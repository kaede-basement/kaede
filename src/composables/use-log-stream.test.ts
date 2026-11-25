import type { Channel } from "@tauri-apps/api/core";
import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, test } from "bun:test";
import { type App, createRenderer } from "vue";

import { useLogStream } from "./use-log-stream.ts";

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

async function withWindow(run: () => Promise<void>): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": { crypto } });
  try {
    await run();
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "window", previous);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
}

test("a reopened viewer receives lines after the old stop arrives", () => withWindow(async () => {
  const starts: Array<number> = [];
  const stops: Array<number> = [];
  const release = Promise.withResolvers<void>();
  let started = Promise.withResolvers<void>();
  let stopped = Promise.withResolvers<void>();
  let next = 0;

  type Subscription = {
    "token"  : number;
    "onEvent": Channel<{ "type": "lines"; "data": Array<string> }>;
  };
  let active: Subscription | undefined;

  mockIPC(async (command, payload) => {
    if (command === "next_log_subscription_id") {
      return ++next;
    }
    const subscription = payload as Subscription;

    if (command === "stream_logs") {
      active = subscription;
      starts.push(subscription.token);
      started.resolve();
    } else if (command === "stop_log_stream") {
      stops.push(subscription.token);
      await release.promise;
      if (active?.token === subscription.token) {
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
}));

test("unmount retires a late token before any stream starts", () => withWindow(async () => {
  const token = Promise.withResolvers<number>();
  const retired = Promise.withResolvers<void>();
  const commands: Array<string> = [];

  mockIPC(async (command, payload) => {
    commands.push(command);
    if (command === "next_log_subscription_id") {
      return token.promise;
    }
    if (command === "stop_log_stream") {
      expect(payload).toMatchObject({ "token": 17 });
      retired.resolve();
    }
  });
  const app = renderer.createApp({
    setup() {
      useLogStream();

      return (): null => null;
    },
  });

  app.mount({});
  app.unmount();
  token.resolve(17);
  await retired.promise;
  expect(commands).toEqual(["next_log_subscription_id", "stop_log_stream"]);
}));

test("Wails stops the legacy subscription on unmount", () => withWindow(async () => {
  const started = Promise.withResolvers<number>();
  const stopped = Promise.withResolvers<number>();

  mockIPC((command, payload) => {
    const { subscriptionId } = (payload ?? {}) as { "subscriptionId": number };

    if (command === "stream_logs") {
      started.resolve(subscriptionId);
    } else if (command === "stop_log_stream") {
      stopped.resolve(subscriptionId);
    }
  });
  const app = renderer.createApp({
    setup() {
      useLogStream();

      return (): null => null;
    },
  });

  app.mount({});
  const id = await started.promise;

  expect(typeof id).toBe("number");
  app.unmount();
  expect(await stopped.promise).toBe(id);
}));
