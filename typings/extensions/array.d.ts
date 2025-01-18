interface Array<T> {
  // biome-ignore lint/suspicious/noExplicitAny: https://github.com/microsoft/TypeScript/issues/16655#issuecomment-2140686720
  filter<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): S[];
  filter<P extends (value: T, index: number, array: T[]) => unknown>(
    predicate: P,
    thisArg?: unknown,
  ): (P extends BooleanConstructor ? Exclude<T, null | undefined | 0 | false | ''> : T)[];
}
