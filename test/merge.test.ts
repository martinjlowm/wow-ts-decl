import { Range, SemVer } from 'semver';

import { expectToBeTruthy } from '#$/utils.js';
import { API, APIBuilder, APIFunction, type APIFunctionProps } from '#@/api.js';

function createFunction(props: Pick<APIFunctionProps, 'name'> & Partial<APIFunctionProps>) {
  return new APIFunction({
    parameters: [],
    returns: [],
    version: new SemVer('1.0.0'),
    ...props,
  });
}

describe('merge', () => {
  describe('combines', () => {
    it('inside', () => {
      const apiBuilder = new APIBuilder();

      for (const version of ['1.0.0', '2.0.0', '3.0.0']) {
        const exact = createFunction({ name: 'Foo', version: new SemVer(version) });
        const above = createFunction({ name: 'Bar', version: new Range(`>${version}`) });
        const below = createFunction({ name: 'Baz', version: new Range(`<${version}`) });

        const api = new API();
        api.addFunction(exact);
        api.addFunction(above);
        api.addFunction(below);

        apiBuilder.add(api);
      }

      const merged = apiBuilder.merge();
      expectToBeTruthy(merged);

      const filteredAPI = merged.filterForVersion(new SemVer('2.0.0'));
      // Bar 1.0.0
      // Foo 2.0.0
      // Baz 3.0.0

      expect(filteredAPI.functions).toHaveLength(3);
      expect(filteredAPI.functions.map((f) => f.name)).toContain('Foo');
      expect(filteredAPI.functions.map((f) => f.name)).toContain('Bar');
      expect(filteredAPI.functions.map((f) => f.name)).toContain('Baz');

      const [lower, mid, upper] = filteredAPI.functions;
      expect(lower?.version.format()).toEqual('1.0.0||2.0.0||3.0.0');
      expect(mid?.version.format()).toEqual('>1.0.0');
      expect(upper?.version.format()).toEqual('<3.0.0');
    });
  });
});
