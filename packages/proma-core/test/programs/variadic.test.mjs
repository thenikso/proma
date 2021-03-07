import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';
import { js, compileAndRun, compileAndRunResult } from '../utils.mjs';
import { Log, Literal } from '../lib.mjs';

describe('[programs/variadic] variadic input data', async (assert) => {
  const Sum = chip('Sum', () => {
    const numbers = inputData('numbers', {
      variadic: '{letter}',
      canonical: true,
    });
    const value = outputData('value', () => {
      return numbers().reduce((acc, n) => acc + n, 0);
    });
  });

  assert({
    given: 'a variadic chip instance',
    should: 'compile as expected',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const sum = new Sum(1, 2, 3);
      sum.id = 'Sum';
      sum.in.B = 20;
      const num = new Literal(100);

      const log = new Log();

      wire(onCreate.out.then, log.in.exec);
      wire(log.in.message, sum.out.value);
      wire(num.out.value, sum.in.D);
    }),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const Sum__value = () => {
            return [1, 20, 3, 100].reduce((acc, n) => acc + n, 0);
          };

          {
            console.log(Sum__value());
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      [124],
    ),
  });

  assert({
    given: 'a connection from an outlet to a variadic port',
    should: 'compile as expected',
    actual: compileAndRun(
      ({ OnCreate }) => {
        const onCreate = new OnCreate();
        const input = inputData('input', { canonical: true });

        const sum = new Sum(1, 2, 3);
        sum.id = 'Sum';
        sum.in.B = 20;
        const num = new Literal(100);

        const log = new Log();

        wire(onCreate.out.then, log.in.exec);
        wire(log.in.message, sum.out.value);
        wire(num.out.value, sum.in.D);
        wire(input, sum.in.E);
      },
      null,
      [1000],
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor(input = 1000) {
          const $in = Object.seal({
            input
          });

          const Sum__value = () => {
            return [1, 20, 3, 100, $in.input].reduce((acc, n) => acc + n, 0);
          };

          Object.defineProperties(this.in = {}, {
            input: {
              get: () => () => $in.input,

              set: value => {
                $in.input = value;
              }
            }
          });

          Object.freeze(this.in);

          {
            console.log(Sum__value());
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      [1124],
    ),
  });

  // TODO test can not add multiple variadic
  // TODO test can not add non-variadic after variadic
});

describe.only('[programs/variadic] variadic output flow', async (assert) => {
  const Sequence = chip('test/programs/variadic/Sequence', () => {
    const exec = inputFlow('exec', () => {
      for (const t of then()) {
        t();
      }
    });
    const then = outputFlow('then', { variadic: 'then{index}' });
  });

  assert({
    given: 'a variadic output flow port (Sequence)',
    should: 'run all connected outputs in sequence',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const seq = new Sequence();
      const log1 = new Log('one');
      const log2 = new Log('two');
      wire(onCreate.out.then, seq.in.exec);
      wire(seq.out.then1, log2.in.exec);
      wire(seq.out.then0, log1.in.exec);
    }),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const test_programs_variadic_Sequence_1__then0 = () => {
            console.log("one");
          };

          const test_programs_variadic_Sequence_1__then1 = () => {
            console.log("two");
          };

          {
            for (const t of [
              test_programs_variadic_Sequence_1__then0,
              test_programs_variadic_Sequence_1__then1
            ]) {
              t();
            }
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['one', 'two'],
    ),
  });
});
