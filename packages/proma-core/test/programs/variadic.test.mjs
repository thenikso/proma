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
import { Log, Literal } from '../../lib/index.mjs';

describe('[programs/variadic] variadic ports', async (assert) => {
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
    actual: compileAndRun(({ onCreate }) => {
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

          console.log(Sum__value());
        }
      }`,
      [124],
    ),
  });

  assert({
    given: 'a connection from an outlet to a variadic port',
    should: 'compile as expected',
    actual: compileAndRun(
      ({ onCreate }) => {
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
          console.log(Sum__value());
        }
      }`,
      [1124],
    ),
  });

  // TODO test can not add multiple variadic
  // TODO test can not add non-variadic after variadic
});
