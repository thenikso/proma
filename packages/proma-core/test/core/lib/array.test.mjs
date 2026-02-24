import { describe } from '../../runner/riteway.mjs';
import { library } from '../../../core/index.mjs';

describe('[core/lib/array] ForEach', async (assert) => {
  assert({
    given: 'an array',
    should: 'iterate over each element',
    actual: (() => {
      const fe = new library.std.array.ForEach([1, 2, 3]);
      const log = [];
      fe.out.body(() => log.push(fe.out.element()));
      fe.out.completed(() => log.push('done'));
      fe.in.exec();
      return log;
    })(),
    expected: [1, 2, 3, 'done'],
  });

  assert({
    given: 'an array',
    should: 'provide correct indices',
    actual: (() => {
      const fe = new library.std.array.ForEach(['a', 'b', 'c']);
      const log = [];
      fe.out.body(() => log.push(fe.out.index()));
      fe.in.exec();
      return log;
    })(),
    expected: [0, 1, 2],
  });
});

describe('[core/lib/array] Map', async (assert) => {
  assert({
    given: 'an array to map',
    should: 'collect mapped values',
    actual: (() => {
      const m = new library.std.array.Map([1, 2, 3]);
      m.out.body(() => {
        m.in.mappedValue = m.out.element() * 2;
      });
      let result;
      m.out.completed(() => {
        result = m.out.output();
      });
      m.in.exec();
      return result;
    })(),
    expected: [2, 4, 6],
  });
});

describe('[core/lib/array] Filter', async (assert) => {
  assert({
    given: 'an array to filter',
    should: 'keep elements where condition is true',
    actual: (() => {
      const f = new library.std.array.Filter([1, 2, 3, 4, 5]);
      f.out.body(() => {
        f.in.condition = f.out.element() > 2;
      });
      let result;
      f.out.completed(() => {
        result = f.out.output();
      });
      f.in.exec();
      return result;
    })(),
    expected: [3, 4, 5],
  });
});

describe('[core/lib/array] Reduce', async (assert) => {
  assert({
    given: 'an array to sum',
    should: 'reduce to single value',
    actual: (() => {
      const r = new library.std.array.Reduce([1, 2, 3, 4], 0);
      r.out.body(() => {
        r.in.result = r.out.accumulator() + r.out.element();
      });
      let result;
      r.out.completed(() => {
        result = r.out.output();
      });
      r.in.exec();
      return result;
    })(),
    expected: 10,
  });

  assert({
    given: 'an array of strings to concatenate',
    should: 'reduce to joined string',
    actual: (() => {
      const r = new library.std.array.Reduce(['a', 'b', 'c'], '');
      r.out.body(() => {
        r.in.result = r.out.accumulator() + r.out.element();
      });
      let result;
      r.out.completed(() => {
        result = r.out.output();
      });
      r.in.exec();
      return result;
    })(),
    expected: 'abc',
  });
});
