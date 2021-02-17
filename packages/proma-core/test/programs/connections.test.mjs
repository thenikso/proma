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
import { Log } from '../../lib/index.mjs';

describe('[programs/connections] input flow (execs) multi-connections', async (assert) => {
  assert({
    given: 'multiple connections to an input flow inlet',
    should: 'compile as a function',
    actual: compileAndRun(
      ({ onCreate }) => {
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
          Log__exec();
        }
      }`,
      ['test', 'test'],
    ),
  });

  assert({
    given: 'multiple connections to an output flow outlet',
    should: 'compile to call the continaution outlet',
    actual: compileAndRun(
      ({ onCreate }) => {
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
          this.$out = Object.seal({
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
                  this.$out.then = value;
                  return;
                }

                (this.$out.then || (() => {}))();
              }
            }
          });

          Object.seal(this.out);
          this.out.then();
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
      ({ onCreate }) => {
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
          this.$out = Object.seal({
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
              value: () => this.$out.output
            },

            then: {
              value: value => {
                if (typeof value !== "undefined") {
                  this.$out.then = value;
                  return;
                }

                this.$out.output = Greet__value();
                (this.$out.then || (() => {}))();
              }
            }
          });

          Object.seal(this.out);
          console.log(Greet__value());
          this.out.then();
        }
      }`,
      ['Hello test!', ['Hello test!']],
    ),
  });

  assert({
    given: 'multiple connections from an input data outlet',
    should: 'compile',
    actual: compileAndRun(
      ({ onCreate }) => {
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
          this.$in = Object.seal({
            input
          });

          this.$out = Object.seal({
            output: undefined,
            then: undefined
          });

          const Log__exec = () => {
            console.log(this.$in.input);
            this.out.then();
          };

          Object.defineProperties(this.in = {}, {
            input: {
              get: () => () => this.$in.input,

              set: value => {
                this.$in.input = value;
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
              value: () => this.$out.output
            },

            then: {
              value: value => {
                if (typeof value !== "undefined") {
                  this.$out.then = value;
                  return;
                }

                this.$out.output = this.$in.input;
                (this.$out.then || (() => {}))();
              }
            }
          });

          Object.seal(this.out);
          Log__exec();
        }
      }`,
      ['test-input', ['test-input']],
    ),
  });
});
