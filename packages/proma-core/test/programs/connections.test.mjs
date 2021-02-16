import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';
import { js, chipCompile, withChipClass } from '../utils.mjs';
import { Start, Log } from '../../lib/index.mjs';

describe('[programs/connections] input flow (execs) multi-connections', async (assert) => {
  assert({
    given: 'multiple connections to an input flow inlet',
    should: 'compile as a function',
    actual: chipCompile(() => {
      const exec = inputFlow('exec');
      const start = new Start();
      const log = new Log();
      log.id = 'Log';

      wire(exec, log.in.exec);
      wire(start.out.then, log.in.exec);
    }),
    expected: js`
    class TestChip {
      constructor() {
        const Log__exec = () => {
          console.log();
        };

        Log__exec();

        Object.defineProperties(this, {
          exec: {
            value: () => {
              Log__exec();
            }
          }
        });
      }
    }`,
  });

  assert({
    given: 'multiple connections to an output flow outlet',
    should: 'compile to call the continaution outlet',
    actual: chipCompile(() => {
      const exec = inputFlow('exec');
      const start = new Start();
      const then = outputFlow('then');

      wire(exec, then);
      wire(start.out.then, then);
    }),
    expected: js`
    class TestChip {
      constructor() {
        this.cont = Object.seal({
          then: undefined
        });

        Object.defineProperties(this.$cont = {}, {
          then: {
            value: () => {
              (this.cont.then || (() => {}))();
            }
          }
        });

        this.$cont.then();

        Object.defineProperties(this, {
          exec: {
            value: () => {
              this.$cont.then();
            }
          }
        });
      }
    }`,
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
    actual: chipCompile(() => {
      const start = new Start();
      const msg = new Greet('test');
      msg.id = 'Greet';
      const log = new Log();

      const then = outputFlow('then');
      const output = outputData('output');

      wire(start.out.then, log.in.exec);
      wire(log.out.then, then);
      wire(msg.out.value, log.in.message);
      wire(msg.out.value, output);
    }),
    expected: js`
    class TestChip {
      constructor() {
        this.out = {
          output: undefined
        };

        this.cont = Object.seal({
          then: undefined
        });

        const Greet__value = () => {
          let greet = "Hello ";
          greet += "test";
          return greet + "!";
        };

        Object.seal(this.out);

        Object.defineProperties(this.$cont = {}, {
          then: {
            value: () => {
              this.out.output = Greet__value();
              (this.cont.then || (() => {}))();
            }
          }
        });

        console.log(Greet__value());
        this.$cont.then();
      }
    }`,
  });

  assert({
    given: 'multiple connections from an input data outlet',
    should: 'compile',
    actual: chipCompile(() => {
      const exec = inputFlow('exec');
      const input = inputData('input');

      const start = new Start();
      const log = new Log();
      log.id = 'Log';

      const then = outputFlow('then');
      const output = outputData('output');

      wire(input, log.in.message);
      wire(input, output);
      wire(exec, log.in.exec);
      wire(start.out.then, log.in.exec);
      wire(log.out.then, then);
    }),
    expected: js`
    class TestChip {
      constructor() {
        this.in = Object.seal({
          input: undefined
        });

        this.out = {
          output: undefined
        };

        this.cont = Object.seal({
          then: undefined
        });

        const Log__exec = () => {
          console.log(this.in.input);
          this.$cont.then();
        };

        Object.seal(this.out);

        Object.defineProperties(this.$cont = {}, {
          then: {
            value: () => {
              this.out.output = this.in.input;
              (this.cont.then || (() => {}))();
            }
          }
        });

        Log__exec();

        Object.defineProperties(this, {
          exec: {
            value: () => {
              Log__exec();
            }
          }
        });
      }
    }`,
  });
});
