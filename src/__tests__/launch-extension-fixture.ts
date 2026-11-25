type LaunchHooks = Window["__KAEDE__"]["hooks"]["onMinecraftLaunch"];

type MinecraftProcessType = Parameters<LaunchHooks["after"][number]>[0]["process"];

export function launchHooks(
  response: "continue" | "veto" | MinecraftProcessType, asyncHook: boolean,
  received: (
    java: string, arguments_: string[], instance: string, directory: string, pid?: number,
  ) => void,
): LaunchHooks {
  const before: LaunchHooks["before"][number] = ({ command, instanceId, necessaries }) => {
    received(command.java, command.arguments, instanceId, necessaries.directories.instance);
    if (response === "continue") return { "status": "continue" };
    if (response === "veto") {
      return { "status": "stop", "response": { "success": false, "process": undefined } };
    }

    return { "status": "stop", "response": { "success": true, "process": response } };
  };
  const after: LaunchHooks["after"][number] = ({ command, instanceId, necessaries, process }) => {
    received(
      command.java, command.arguments, instanceId, necessaries.directories.instance, process.pid,
    );
  };

  const asyncBefore: typeof before = async payload => before(payload);

  return {
    "before": [asyncHook ? asyncBefore : before],
    "after" : [asyncHook ? async (payload): Promise<void> => after(payload) : after],
  };
}

const missingProcess: LaunchHooks["before"][number] = () => ({
  "status"  : "stop",
  // @ts-expect-error Failure results also carry the process property.
  "response": { "success": false },
});

void missingProcess;

// @ts-expect-error A stop response requires a launch result.
const invalid: LaunchHooks["before"][number] = () => ({ "status": "stop", "response": undefined });

void invalid;
