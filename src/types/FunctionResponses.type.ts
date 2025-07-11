import type { FunctionResponses } from "~/constants/app";

// basically it extracts all values from an object and makes it as a type
export type FunctionResponsesType = typeof FunctionResponses[keyof typeof FunctionResponses];
