/**
 * Used in '/src/declarations.ts'.
 * All hooks are promises and are stored in the array to handle multiple hooks
 */
export type HookReturnType<ArgumentsType, ResponseType> = Array<(...args: ArgumentsType[]) => Promise<{
  // 'stop' aborts a function that executed current hook
  "status"  : "stop" | "continue";
  // if 'status' is 'stop', function will return this field
  "response": ResponseType | Promise<ResponseType>;
}>>;