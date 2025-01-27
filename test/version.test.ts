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
  describe('greater than', () => {
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

  describe('any', () => {
    it('consumes a version', () => {
      const base = new Version(new Range('*'));
      const extending = new Version(new SemVer('2.0.0'));

      base.extend(extending.version);

      expectToBeInstanceOf(base.version, Range);
      expect(base.version.format()).toEqual('');
    });
  });

  it('adds version to range', () => {
    const base = new Version(new Range('>=2.0.0'));
    const extending = new Version(new SemVer('1.0.0'));

    base.extend(extending.version);

    expectToBeInstanceOf(base.version, Range);
    expect(base.version.format()).toEqual('>=2.0.0||1.0.0');
  });

  function createRangeTest([left, right, result, only = false]: readonly [string, string, string, boolean?]) {
    const func = only ? it.only : it;
    func(`${left} extend ${right} -> ${result}`, () => {
      const lower = new Version(new Range(left));
      const upper = new Version(new Range(right));

      lower.extend(upper.version);

      expect(lower.version.format()).toEqual(result);
    });
  }

  describe('consumes', () => {
    const cases = [
      ['>1.0.0', '>2.0.0', '>1.0.0'],
      ['>1.0.0', '>=1.0.0', '>=1.0.0'],
      ['>1.0.0', '>=2.0.0', '>1.0.0'],
    ] as const;

    cases.forEach(createRangeTest);
  });

  describe('limits', () => {
    const cases = [
      ['>1.0.0', '<=2.0.0', '>1.0.0 <=2.0.0'],
      ['>1.0.0', '<2.0.0', '>1.0.0 <2.0.0'],
      ['>1.0.0', '<1.0.0', '>1.0.0 <1.0.0'],
      ['>1.0.0', '<=1.0.0', '>1.0.0 <=1.0.0'],
    ] as const;

    cases.forEach(createRangeTest);
  });
});
