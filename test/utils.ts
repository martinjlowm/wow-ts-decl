export function expectToBeInstanceOf<T, A extends unknown[]>(
  arg: unknown,
  ctor: new (...args: A) => T,
): asserts arg is T {
  expect(arg).toBeInstanceOf(ctor);
}

export function expectToBeTruthy<T>(arg: T): asserts arg is NonNullable<T> {
  expect(arg).toBeTruthy();
}
