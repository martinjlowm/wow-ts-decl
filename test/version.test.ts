import { Range, SemVer } from 'semver';

import { Version } from '#@/api.js';

import { expectToBeInstanceOf } from '#$/utils.js';

describe('version', () => {
  it('extends a range', () => {
    const base = new Version(new SemVer('1.0.0'));
    const extending = new Version(new SemVer('2.0.0'));

    base.extend(extending.version);

    expectToBeInstanceOf(base.version, Range);
    expect(base.version.test('1.0.0')).toBeTruthy();
    expect(base.version.test('2.0.0')).toBeTruthy();
  });

  it('converts to a range', () => {
    const base = new Version(new SemVer('1.0.0'));
    const extending = new Version(new Range('<=2.0.0'));

    base.extend(extending.version);

    expectToBeInstanceOf(base.version, Range);
    expect(base.version.test('1.0.0')).toBeTruthy();
    expect(base.version.test('2.0.0')).toBeTruthy();
  });
});

describe('range', () => {
  it('consumes a version', () => {
    const base = new Version(new Range('>=1.0.0'));
    const extending = new Version(new SemVer('2.0.0'));

    base.extend(extending.version);

    expectToBeInstanceOf(base.version, Range);
    expect(base.version.format()).toEqual('>=1.0.0');
    expect(base.version.test('1.0.0')).toBeTruthy();
    expect(base.version.test('2.0.0')).toBeTruthy();
  });
});
