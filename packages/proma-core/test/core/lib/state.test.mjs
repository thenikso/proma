import { describe } from '../../runner/riteway.mjs';
import { library } from '../../../core/index.mjs';

describe('[core/lib/state] State', async (assert) => {
  const State = library.std.state.State;

  assert({
    given: 'a new State with initial value',
    should: 'return the initial value',
    actual: (() => {
      const s = new State('hello');
      return s.out.value();
    })(),
    expected: 'hello',
  });

  assert({
    given: 'a State after set',
    should: 'return the new value and previous value',
    actual: (() => {
      const s = new State('hello');
      s.in.newValue = 'world';
      s.in.set();
      return { value: s.out.value(), prev: s.out.previousValue() };
    })(),
    expected: { value: 'world', prev: 'hello' },
  });

  assert({
    given: 'a State with onChange listener',
    should: 'fire onChange when set is called',
    actual: (() => {
      const s = new State(0);
      const log = [];
      s.out.onChange(() => log.push(s.out.value()));
      s.in.newValue = 1;
      s.in.set();
      s.in.newValue = 2;
      s.in.set();
      return log;
    })(),
    expected: [1, 2],
  });
});

describe('[core/lib/state] Counter', async (assert) => {
  const Counter = library.std.state.Counter;

  assert({
    given: 'a new Counter',
    should: 'start at initialValue',
    actual: (() => {
      const c = new Counter(10);
      return c.out.count();
    })(),
    expected: 10,
  });

  assert({
    given: 'increment and decrement',
    should: 'update count',
    actual: (() => {
      const c = new Counter(0, 1);
      c.in.increment();
      c.in.increment();
      c.in.decrement();
      return c.out.count();
    })(),
    expected: 1,
  });

  assert({
    given: 'reset',
    should: 'return to initial value',
    actual: (() => {
      const c = new Counter(5);
      c.in.increment();
      c.in.increment();
      c.in.reset();
      return c.out.count();
    })(),
    expected: 5,
  });
});

describe('[core/lib/state] Toggle', async (assert) => {
  const Toggle = library.std.state.Toggle;

  assert({
    given: 'a new Toggle',
    should: 'start false',
    actual: (() => {
      const t = new Toggle();
      return t.out.value();
    })(),
    expected: false,
  });

  assert({
    given: 'exec toggles',
    should: 'flip the value each time',
    actual: (() => {
      const t = new Toggle();
      t.in.exec();
      const v1 = t.out.value();
      t.in.exec();
      const v2 = t.out.value();
      return [v1, v2];
    })(),
    expected: [true, false],
  });

  assert({
    given: 'setTrue and setFalse',
    should: 'set explicit values',
    actual: (() => {
      const t = new Toggle();
      t.in.setTrue();
      const v1 = t.out.value();
      t.in.setFalse();
      const v2 = t.out.value();
      return [v1, v2];
    })(),
    expected: [true, false],
  });
});

describe('[core/lib/state] Gate', async (assert) => {
  const Gate = library.std.state.Gate;

  assert({
    given: 'condition is true',
    should: 'fire then',
    actual: (() => {
      const g = new Gate(true);
      const log = [];
      g.out.then(() => log.push('fired'));
      g.in.exec();
      return log;
    })(),
    expected: ['fired'],
  });

  assert({
    given: 'condition is false',
    should: 'not fire then',
    actual: (() => {
      const g = new Gate(false);
      const log = [];
      g.out.then(() => log.push('fired'));
      g.in.exec();
      return log;
    })(),
    expected: [],
  });
});
