export type DeepNonNullable<T> = T extends object ? {
  [P in keyof T]: DeepNonNullable<NonNullable<T[P]>>;
} : T;
