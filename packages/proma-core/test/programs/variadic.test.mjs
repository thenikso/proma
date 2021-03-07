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

describe('[programs/variadic] variadic output flow', async (assert) => {
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

  const SequenceUnrolled = chip(
    'test/programs/variadic/SequenceUnrolled',
    () => {
      const exec = inputFlow('exec', {
        execute: () => {
          for (const t of then()) {
            t();
          }
        },
        executeCompiler: (
          portInstance,
          outterScope,
          codeWrapper,
          { compile, recast },
        ) => {
          const calls = [];
          for (const p of portInstance.chip.out.then.variadic) {
            if (p) {
              calls.push(compile(p, outterScope, codeWrapper));
            }
          }
          return recast.types.builders.blockStatement(
            calls.map((c) => recast.types.builders.expressionStatement(c)),
          );
        },
      });
      const then = outputFlow('then', { variadic: 'then{index}' });
    },
  );

  assert({
    given: 'a variadic output flow port with custom executeCompiler',
    should: 'run all connected outputs in sequence',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const seq = new SequenceUnrolled();
      const log1 = new Log('one');
      const log2 = new Log('two');
      wire(onCreate.out.then, seq.in.exec);
      wire(seq.out.then2, log2.in.exec);
      wire(seq.out.then0, log1.in.exec);
    }),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const test_programs_variadic_SequenceUnrolled_1__then0 = () => {
            console.log("one");
          };

          const test_programs_variadic_SequenceUnrolled_1__then1 = () => {};

          const test_programs_variadic_SequenceUnrolled_1__then2 = () => {
            console.log("two");
          };

          {
            test_programs_variadic_SequenceUnrolled_1__then0();
            test_programs_variadic_SequenceUnrolled_1__then1();
            test_programs_variadic_SequenceUnrolled_1__then2();
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
