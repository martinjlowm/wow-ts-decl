import { Range, SemVer } from 'semver';

import { expectToBeInstanceOf, expectToBeTruthy } from '#$/utils.js';
import { API, APIEvent, APIFunction, APITable } from '#@/api.js';

describe('API', () => {
  describe('combines', () => {
    describe('new type signature', () => {
      it('function', () => {
        const leftFunction = new APIFunction({
          name: 'FooBar',
          parameters: [],
          returns: [],
          version: new SemVer('1.0.0'),
        });

        const left = new API();
        left.addFunction(leftFunction);

        const rightFunction = new APIFunction({
          name: 'FooBar',
          parameters: [{ name: 'foo', type: 'string', nilable: true }],
          returns: [],
          version: new SemVer('2.0.0'),
        });
        const right = new API();
        right.addFunction(rightFunction);

        const combined = left.combine(right);
        expect(combined.functions).toHaveLength(2);
      });

      it('table', () => {
        const leftTable = new APITable({
          name: 'FooBar',
          fields: [],
          version: new SemVer('1.0.0'),
        });

        const left = new API();
        left.addTable(leftTable);

        const rightTable = new APITable({
          name: 'FooBar',
          fields: [{ name: 'foo', type: 'string', nilable: true }],
          version: new SemVer('2.0.0'),
        });
        const right = new API();
        right.addTable(rightTable);

        const combined = left.combine(right);
        expect(combined.tables).toHaveLength(2);
      });

      it('event', () => {
        const leftEvent = new APIEvent({
          name: 'FooBar',
          literalName: 'FooBar',
          payload: [],
          version: new SemVer('1.0.0'),
        });

        const left = new API();
        left.addEvent(leftEvent);

        const rightEvent = new APIEvent({
          name: 'FooBar',
          literalName: 'FooBar',
          payload: [{ name: 'foo', type: 'string', nilable: true }],
          version: new SemVer('2.0.0'),
        });
        const right = new API();
        right.addEvent(rightEvent);

        const combined = left.combine(right);
        expect(combined.events).toHaveLength(2);
      });
    });

    it('functions', () => {
      const leftFunction = new APIFunction({
        name: 'FooBar',
        parameters: [],
        returns: [],
        version: new SemVer('1.0.0'),
      });

      const left = new API();
      left.addFunction(leftFunction);

      const rightFunction = new APIFunction({
        name: 'BarBaz',
        parameters: [],
        returns: [],
        version: new SemVer('1.0.0'),
      });
      const right = new API();
      right.addFunction(rightFunction);

      const combined = left.combine(right);
      expect(combined.functions.map((f) => f.name)).toContain('FooBar');
      expect(combined.functions.map((f) => f.name)).toContain('BarBaz');
    });

    it('tables', () => {
      const leftTable = new APITable({
        name: 'FooBar',
        fields: [],
        version: new SemVer('1.0.0'),
      });

      const left = new API();
      left.addTable(leftTable);

      const rightTable = new APITable({
        name: 'BarBaz',
        fields: [],
        version: new SemVer('1.0.0'),
      });
      const right = new API();
      right.addTable(rightTable);

      const combined = left.combine(right);
      expect(combined.tables.map((f) => f.name)).toContain('FooBar');
      expect(combined.tables.map((f) => f.name)).toContain('BarBaz');
    });

    it('events', () => {
      const leftEvent = new APIEvent({
        name: 'FooBar',
        literalName: 'FooBar',
        payload: [],
        version: new SemVer('1.0.0'),
      });

      const left = new API();
      left.addEvent(leftEvent);

      const rightEvent = new APIEvent({
        name: 'BarBaz',
        literalName: 'BarBaz',
        payload: [],
        version: new SemVer('1.0.0'),
      });
      const right = new API();
      right.addEvent(rightEvent);

      const combined = left.combine(right);
      expect(combined.events.map((f) => f.name)).toContain('FooBar');
      expect(combined.events.map((f) => f.name)).toContain('BarBaz');
    });
  });

  describe('extends', () => {
    it('function range', () => {
      const leftFunction = new APIFunction({
        name: 'FooBar',
        parameters: [],
        returns: [],
        version: new SemVer('1.0.0'),
      });

      const left = new API();
      left.addFunction(leftFunction);

      const rightFunction = new APIFunction({
        name: 'FooBar',
        parameters: [],
        returns: [],
        version: new SemVer('2.0.0'),
      });
      const right = new API();
      right.addFunction(rightFunction);

      const combined = left.combine(right);
      const [func] = combined.functions;
      expectToBeTruthy(func);
      expectToBeInstanceOf(func.version, Range);
    });
  });

  describe('filters', () => {
    it('functions not available for version', () => {
      const leftFunction = new APIFunction({
        name: 'FooBar',
        parameters: [],
        returns: [],
        version: new SemVer('1.0.0'),
      });

      const left = new API();
      left.addFunction(leftFunction);

      const rightFunction = new APIFunction({
        name: 'FooBar',
        parameters: [],
        returns: [],
        version: new SemVer('2.0.0'),
      });
      const right = new API();
      right.addFunction(rightFunction);

      const combined = left.combine(right);
      const filtered = combined.filterForVersion(new SemVer('3.0.0'));
      expect(filtered.functions).toHaveLength(0);
    });
  });

  describe('keeps', () => {
    it('functions available for version', () => {
      const leftFunction = new APIFunction({
        name: 'FooBar',
        parameters: [],
        returns: [],
        version: new SemVer('1.0.0'),
      });

      const left = new API();
      left.addFunction(leftFunction);

      const rightFunction = new APIFunction({
        name: 'FooBar',
        parameters: [],
        returns: [],
        version: new SemVer('2.0.0'),
      });
      const right = new API();
      right.addFunction(rightFunction);

      const combined = left.combine(right);
      const filtered = combined.filterForVersion(new SemVer('2.0.0'));
      expect(filtered.functions).toHaveLength(1);
    });
  });
});
