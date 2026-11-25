import * as dialog from "@tauri-apps/plugin-dialog";
import { expect, mock, spyOn, test } from "bun:test";
import { computed } from "vue";

import {
  LaunchInstanceContextKey, LaunchInstanceStatusesContextKey, LaunchOptionItems,
} from "@/constants/application.ts";
import { Actions } from "@/extendable/action-registry.ts";
import { globalStates } from "@/states/global.ts";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

test("launch options report rejected callbacks and stay quiet on deliberate stops", async () => {
  declareInstanceStates();
  globalStates.selected.currentInstance = "A";
  instanceStates.A = {} as InstanceStateType;
  const key = LaunchOptionItems[0].action;
  const previous = Actions[key];

  using cleanup = new DisposableStack;
  cleanup.defer(() => {
    if (previous) {
      Actions[key] = previous;
    } else {
      delete Actions[key];
    }
  });
  const action = mock().mockRejectedValueOnce(new Error("failed"))
    .mockResolvedValue(false);

  Actions[key] = action;
  using notify = spyOn(dialog, "message").mockResolvedValue("Ok");
  using view = await mountComponent("home/instance/LaunchOptions", {}, app => {
    app.provide(LaunchInstanceContextKey, mock());
    app.provide(LaunchInstanceStatusesContextKey, { "launchable": computed(() => true) });
  });
  const button = view.root.querySelector<HTMLButtonElement>("[id*=dropdown-item]")!;

  button.click();
  await Bun.sleep(0);
  expect(notify).toHaveBeenCalledTimes(1);
  button.click();
  await Bun.sleep(0);
  expect(action).toHaveBeenCalledTimes(2);
  expect(notify).toHaveBeenCalledTimes(1);
});

test("library right-click does not open the home selection menu", async () => {
  globalStates.selected.currentInstance = "A";
  using view = await mountComponent("library/InstanceEntry", {
    "instanceId": "B", "instance": { "name": "B" }, "idRoot": "library-B",
  });
  const menu = mock();

  view.root.addEventListener("contextmenu", menu);
  const click = new view.browser.MouseEvent("contextmenu", {
    "bubbles": true, "cancelable": true, "button": 2,
  });

  view.root.querySelector("button")!.dispatchEvent(click as unknown as Event);
  expect(click.defaultPrevented).toBe(true);
  expect(menu).not.toHaveBeenCalled();
  expect(globalStates.selected.currentInstance).toBe("A");
});
