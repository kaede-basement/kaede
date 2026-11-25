import Application from "@/constants/application.ts";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { TabSectionType } from "@/types/ui/tab-section.type.ts";

export const DefaultGlobalStatesPagesStates: GlobalStatesType["pages"] = {
  "home"    : {},
  "library" : { "selected": undefined },
  "settings": { "tab": "user-interface" },
  "profile" : {
    "pending": false,
    "step"   : null,
    "error"  : null,
  },
  "add-instance": {

    /*
     * Preferably, we should not interfere with the customizable options
     * that were made purely for extensions. However, I wanted to use
     * these type of things so many times because it is simpler for me, lol
     */
    "customSettings": [
      {
        "input": {
          "onInput": (value: string): void => {
            const currentState = globalStates.pages["add-instance"];

            if (!currentState.instance) {
              globalStates.pages["add-instance"].instance = Instances
                .extractSavedFromPages(currentState.instance, globalStates.minecraft);
            }

            if (currentState.instance) {
              currentState.instance.add.jvmArguments = Launcher.Arguments.splitArguments(value);
            }
          },
          "placeholder"  : "JVM arguments",
          "iconClassName": "i-lucide-braces",
          "defaultValue" : (): string | undefined => {
            const currentInstance = globalStates.pages["add-instance"].instance;

            if (!currentInstance) {
              return Launcher.Arguments.joinArguments(globalStates.minecraft.add?.jvmArguments);
            }

            return Launcher.Arguments.joinArguments(currentInstance.add.jvmArguments);
          },
          "debounceTime": 300,
          "tooltip"     : "Specify your JVM arguments here",
          "type"        : "text",
        },
      },
      {
        "input": {
          "onInput": (value: string): void => {
            const currentState = globalStates.pages["add-instance"];

            if (!currentState.instance) {
              globalStates.pages["add-instance"].instance = Instances
                .extractSavedFromPages(currentState.instance, globalStates.minecraft);
            }

            if (currentState.instance) {
              currentState.instance.add.gameArguments = Launcher.Arguments.splitArguments(value);
            }
          },
          "placeholder"  : "Game arguments",
          "iconClassName": "i-lucide-gamepad-2",
          "defaultValue" : (): string | undefined => {
            const currentInstance = globalStates.pages["add-instance"].instance;

            if (!currentInstance) {
              return Launcher.Arguments.joinArguments(globalStates.minecraft.add?.gameArguments);
            }

            return Launcher.Arguments.joinArguments(currentInstance.add.gameArguments);
          },
          "debounceTime": 300,
          "tooltip"     : "Specify your game arguments here",
          "type"        : "text",
        },
      },
    ],
  },
  "none": {},
};
export const SettingsSections: Array<TabSectionType> = [
  {
    "id"  : "user-interface",
    "name": "User Interface",
    "icon": "i-lucide-paintbrush-vertical",
  },
  {
    "id"  : "minecraft",
    "name": "Minecraft",
    "icon": "i-lucide-box",
  },
  {
    "id"   : "java",
    "name" : "Java",
    "icon" : "i-lucide-coffee",
    "await": () => Launcher.detectJavaInstallations(),
  },
  {
    "id"  : "extensions",
    "name": "Extensions",
    "icon": "i-lucide-blocks",
  },
  {
    "id"  : "development",
    "name": "Development",
    "icon": "i-lucide-construction",
  },
  {
    "id"  : "plugin-playground",
    "name": "Plugin Playground",
    "icon": "i-lucide-square-terminal",
  },
];

export default { ...Application, DefaultGlobalStatesPagesStates, SettingsSections } as const;
