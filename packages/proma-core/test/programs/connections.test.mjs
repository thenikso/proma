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
import { Log, Pass } from '../lib.mjs';

describe('[programs/connections] wire selector paths', async (assert) => {
  assert({
    given: 'string-based selector paths passed to wire',
    should: 'resolve top-level and sub-chip ports',
    actual: chip('SelectorStringWire', () => {
      const exec = inputFlow('exec');
      const input = inputData('input');
      const then = outputFlow('then');
      const output = outputData('output');

      const pass = new Pass();
      pass.id = 'Pass';

      wire('exec', 'Pass.in.exec');
      wire('input', 'Pass.in.input');
      wire('Pass.out.then', 'then');
      wire('Pass.out.output', 'output');
    }).toJSON(),
    expected: {
      URI: 'SelectorStringWire',
      in: [
        { name: 'exec', kind: 'flow' },
        { name: 'input', kind: 'data' },
      ],
      out: [
        { name: 'then', kind: 'flow' },
        { name: 'output', kind: 'data', computeOn: ['then'] },
      ],
      chips: [{ id: 'Pass', chipURI: 'Pass' }],
      connections: [
        { source: 'in.exec', sink: 'Pass.in.exec' },
        { source: 'in.input', sink: 'Pass.in.input' },
        { source: 'Pass.out.then', sink: 'out.then' },
        { source: 'Pass.out.output', sink: 'out.output' },
      ],
    },
  });

  assert({
    given: 'array-based selector paths passed to wire',
    should: 'resolve selector tokens as connection endpoints',
    actual: chip('SelectorArrayWire', () => {
      const exec = inputFlow('exec');
      const input = inputData('input');
      const then = outputFlow('then');
      const output = outputData('output');

      const pass = new Pass();
      pass.id = 'Pass';

      wire(['in', 'exec'], ['Pass', 'in', 'exec']);
      wire(['in', 'input'], ['Pass', 'in', 'input']);
      wire(['Pass', 'out', 'then'], ['out', 'then']);
      wire(['Pass', 'out', 'output'], ['out', 'output']);
    }).toJSON(),
    expected: {
      URI: 'SelectorArrayWire',
      in: [
        { name: 'exec', kind: 'flow' },
        { name: 'input', kind: 'data' },
      ],
      out: [
        { name: 'then', kind: 'flow' },
        { name: 'output', kind: 'data', computeOn: ['then'] },
      ],
      chips: [{ id: 'Pass', chipURI: 'Pass' }],
      connections: [
        { source: 'in.exec', sink: 'Pass.in.exec' },
        { source: 'in.input', sink: 'Pass.in.input' },
        { source: 'Pass.out.then', sink: 'out.then' },
        { source: 'Pass.out.output', sink: 'out.output' },
      ],
    },
  });
});

describe('[programs/connections] input flow (execs) multi-connections', async (assert) => {
  assert({
    given: 'multiple connections to an input flow inlet',
    should: 'compile as a function',
    actual: compileAndRun(
      ({ OnCreate }) => {
        const onCreate = new OnCreate();
        const exec = inputFlow('exec');
        const log = new Log('test');
        log.id = 'Log';

        wire(exec, log.in.exec);
        wire(onCreate.out.then, log.in.exec);
      },
      (chip, logs) => {
        chip.in.exec();
        return logs;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const Log__exec = () => {
            console.log("test");
          };

          Object.defineProperties(this.in = {}, {
            exec: {
              value: () => {
                Log__exec();
              }
            }
          });

          Object.freeze(this.in);

          {
            Log__exec();
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['test', 'test'],
    ),
  });

  assert({
    given: 'multiple connections to an output flow outlet',
    should: 'compile to call the continaution outlet',
    actual: compileAndRun(
      ({ OnCreate }) => {
        const onCreate = new OnCreate();
        const exec = inputFlow('exec');
        const then = outputFlow('then');

        wire(exec, then);
        wire(onCreate.out.then, then);
      },
      (chip) => {
        let count = 0;
        chip.out.then(() => count++);
        chip.in.exec();
        return count;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $out = Object.seal({
            then: undefined
          });

          Object.defineProperties(this.in = {}, {
            exec: {
              value: () => {
                this.out.then();
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            then: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.then = value;
                  return;
                }

                ($out.then || (() => {}))();
              }
            }
          });

          Object.freeze(this.out);

          {
            this.out.then();
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      1,
    ),
  });
});

// TODO multi cons from output data
// TODO multi cons from input data outlet
describe('[programs/connections] output data multi-connections', async (assert) => {
  const Greet = chip('Greet', () => {
    const name = inputData('name', { canonical: true });
    const value = outputData('value', () => {
      let greet = 'Hello ';
      greet += name();
      return greet + '!';
    });
  });

  assert({
    given: 'multiple connections from an output data inlet',
    should: 'compile',
    actual: compileAndRun(
      ({ OnCreate }) => {
        const onCreate = new OnCreate();
        const msg = new Greet('test');
        msg.id = 'Greet';
        const log = new Log();

        const then = outputFlow('then');
        const output = outputData('output');

        wire(onCreate.out.then, log.in.exec);
        wire(log.out.then, then);
        wire(msg.out.value, log.in.message);
        wire(msg.out.value, output);
      },
      (chip, logs) => {
        return [chip.out.output(), logs];
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $out = Object.seal({
            output: undefined,
            then: undefined
          });

          const Greet__value = () => {
            let greet = "Hello ";
            greet += "test";
            return greet + "!";
          };

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

                $out.output = Greet__value();
                ($out.then || (() => {}))();
              }
            }
          });

          Object.freeze(this.out);

          {
            console.log(Greet__value());
            this.out.then();
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['Hello test!', ['Hello test!']],
    ),
  });

  assert({
    given: 'multiple connections from an input data outlet',
    should: 'compile',
    actual: compileAndRun(
      ({ OnCreate }) => {
        const onCreate = new OnCreate();
        const exec = inputFlow('exec');
        const input = inputData('input', { canonical: true });

        const log = new Log();
        log.id = 'Log';

        const then = outputFlow('then');
        const output = outputData('output');

        wire(input, log.in.message);
        wire(input, output);
        wire(exec, log.in.exec);
        wire(onCreate.out.then, log.in.exec);
        wire(log.out.then, then);
      },
      (chip, logs) => {
        return [chip.out.output(), logs];
      },
      ['test-input'],
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor(input = "test-input") {
          const $in = Object.seal({
            input
          });

          const $out = Object.seal({
            output: undefined,
            then: undefined
          });

          const Log__exec = () => {
            console.log($in.input);
            this.out.then();
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
                Log__exec();
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

                $out.output = $in.input;
                ($out.then || (() => {}))();
              }
            }
          });

          Object.freeze(this.out);

          {
            Log__exec();
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['test-input', ['test-input']],
    ),
  });
});
