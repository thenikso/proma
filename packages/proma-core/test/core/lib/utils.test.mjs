import { describe } from '../../runner/riteway.mjs';
import { js, compileAndRun, compileAndRunResult } from '../../utils.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
  lib,
} from '../../../core/index.mjs';

describe('[core/lib/utils] GetPropertyAtPath', async (assert) => {
  assert({
    given: 'a GetPropertyAtPath usage',
    should: 'compile and run',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec');
        const input = inputData('input', { defaultValue: {} });

        const get = new lib.GetPropertyAtPath('one.1.two', 'fallback');
        get.id = 'GetPropertyAtPath';

        const then = outputFlow('then');
        const output = outputData('output');

        wire(exec, then);
        wire(input, get.in.target);
        wire(get.out.value, output);
      },
      (chip) => {
        const res = [];
        chip.out.then(() => res.push(chip.out.output()));
        chip.in.exec();
        chip.in.input = { one: [{}, { two: 'ok' }] };
        chip.in.exec();
        return res;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $in = Object.seal({
            input: {}
          });

          const $out = Object.seal({
            output: undefined,
            then: undefined
          });

          const GetPropertyAtPath__value = () => {
            const ps = "one.1.two".split(".");
            let cursor = $in.input;

            for (let i = 0, l = ps.length; i < l; i++) {
              if (typeof cursor === "undefined") {
                return "fallback";
              }

              cursor = cursor[ps[i]];
            }

            return cursor;
          };

          Object.defineProperties(this.in = {}, {
            input: {
              get: () => () => $in.input,

              set: value => {
                $in.input = value;
              }
            },

            exec: {
              value: () => {
                this.out.then();
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            output: {
              value: () => $out.output
            },

            then: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.then = value;
                  return;
                }

                $out.output = GetPropertyAtPath__value();
                ($out.then || (() => {}))();
              }
            }
          });

          Object.freeze(this.out);

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['fallback', 'ok'],
    ),
  });

  assert({
    given: 'a GetPropertyAtPath without a fallback value',
    should: 'compile and run',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec');
        const input = inputData('input', { defaultValue: {} });

        const get = new lib.GetPropertyAtPath('one.1.two');
        get.id = 'GetPropertyAtPath';

        const then = outputFlow('then');
        const output = outputData('output');

        wire(exec, then);
        wire(input, get.in.target);
        wire(get.out.value, output);
      },
      (chip) => {
        const res = [];
        chip.out.then(() => res.push(chip.out.output()));
        chip.in.exec();
        return res;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $in = Object.seal({
            input: {}
          });

          const $out = Object.seal({
            output: undefined,
            then: undefined
          });

          const GetPropertyAtPath__value = () => {
            const ps = "one.1.two".split(".");
            let cursor = $in.input;

            for (let i = 0, l = ps.length; i < l; i++) {
              if (typeof cursor === "undefined") {
                return undefined;
              }

              cursor = cursor[ps[i]];
            }

            return cursor;
          };

          Object.defineProperties(this.in = {}, {
            input: {
              get: () => () => $in.input,

              set: value => {
                $in.input = value;
              }
            },

            exec: {
              value: () => {
                this.out.then();
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            output: {
              value: () => $out.output
            },

            then: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.then = value;
                  return;
                }

                $out.output = GetPropertyAtPath__value();
                ($out.then || (() => {}))();
              }
            }
          });

          Object.freeze(this.out);

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      [undefined],
    ),
  });
});

describe.skip('[core/lib/utils] Equal', async (assert) => {
  assert({
    given: 'a GetPropertyAtPath usage',
    should: 'compile and run',
    actual: await compileAndRun(
      () => {
        const exec = inputFlow('exec');
        const input = inputData('input');

        const eq = new lib.Equal('1');
        eq.id = 'Equal';

        const then = outputFlow('then');
        const output = outputData('output');

        wire(exec, then);
        wire(input, eq.in.B);
        wire(eq.out.equal, output);
      },
      (chip) => {
        const res = [];
        chip.out.then(() => res.push(chip.out.output()));
        chip.in.input = '1';
        chip.in.exec();
        chip.in.input = 1;
        chip.in.exec();
        return res;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $in = Object.seal({
            input: undefined
          });

          const $out = Object.seal({
            output: undefined,
            then: undefined
          });

          Object.defineProperties(this.in = {}, {
            input: {
              get: () => () => $in.input,

              set: value => {
                $in.input = value;
              }
            },

            exec: {
              value: () => {
                this.out.then();
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            output: {
              value: () => $out.output
            },

            then: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.then = value;
                  return;
                }

                $out.output = eq("1", $in.input);
                ($out.then || (() => {}))();
              }
            }
          });

          Object.freeze(this.out);

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      [true, false],
    ),
  });
});
