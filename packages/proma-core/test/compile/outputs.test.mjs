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
import { Start, Split, Log, Literal } from '../../lib/index.mjs';

describe('[compile/outputs] pure outputs', async (assert) => {
  assert({
    given: 'a pure output',
    should: 'compile',
    actual: chipCompile(() => {
      const A = inputData('A');
      const B = inputData('B');
      const value = outputData('value', () => A() + B());
    }),
    expected: js`
    class TestChip {
      constructor() {
        this.in = Object.seal({
          A: undefined,
          B: undefined
        });

        this.out = {};

        Object.defineProperties(this.out, {
          value: {
            enumerable: true,
            get: () => this.in.A + this.in.B
          }
        });

        Object.seal(this.out);
      }
    }`,
  });

  // TODO can only have input ports
});

describe('[compile/outputs] executed outputs', async (assert) => {
  assert({
    given: 'an output set in the exec',
    should: 'compile',
    actual: chipCompile(() => {
      const exec = inputFlow('exec', () => {
        value(Math.random());
        then();
      });
      const then = outputFlow('then');
      const value = outputData('value');
    }),
    expected: js`
    class TestChip {
      constructor() {
        this.out = {
          value: undefined
        };

        this.cont = Object.seal({
          then: undefined
        });

        Object.seal(this.out);

        Object.defineProperties(this.$cont = {}, {
          then: {
            value: () => {
              (this.cont.then || (() => {}))();
            }
          }
        });

        Object.defineProperties(this, {
          exec: {
            value: () => {
              this.out.value = Math.random();
              this.$cont.then();
            }
          }
        });
      }
    }`,
  });

  // TODO output port should not have its out compile
});

describe('[compile/outputs] connected outputs (and inlets)', async (assert) => {
  const connectedOutputExpected = js`class TestChip {
    constructor() {
      this.out = {
        output: undefined
      };

      this.cont = Object.seal({
        then: undefined
      });

      Object.seal(this.out);

      Object.defineProperties(this.$cont = {}, {
        then: {
          value: () => {
            this.out.output = "hello world";
            (this.cont.then || (() => {}))();
          }
        }
      });

      console.log("hello world");
      this.$cont.then();
    }
  }`;

  assert({
    given: 'an output connected with array of output flow',
    should: 'compile',
    actual: chipCompile(() => {
      const start = new Start();
      const msg = new Literal('hello world');
      const log = new Log();
      const then = outputFlow('then');
      const output = outputData('output', [then]);

      wire(start.out.then, log.in.exec);
      wire(msg.out.value, log.in.message);
      wire(log.out.then, then);
      wire(msg.out.value, output);
    }),
    expected: connectedOutputExpected,
  });

  assert({
    given: 'an output connected with just one output flow',
    should: 'compile',
    actual: chipCompile(() => {
      const start = new Start();
      const msg = new Literal('hello world');
      const log = new Log();
      const then = outputFlow('then');
      const output = outputData('output', then);

      wire(start.out.then, log.in.exec);
      wire(msg.out.value, log.in.message);
      wire(log.out.then, then);
      wire(msg.out.value, output);
    }),
    expected: connectedOutputExpected,
  });

  assert({
    given: 'an output connected with nothing (auto-connection)',
    should: 'compile',
    actual: chipCompile(() => {
      const start = new Start();
      const msg = new Literal('hello world');
      const log = new Log();
      const then = outputFlow('then');
      const output = outputData('output');

      wire(start.out.then, log.in.exec);
      wire(msg.out.value, log.in.message);
      wire(log.out.then, then);
      wire(msg.out.value, output);
    }),
    expected: connectedOutputExpected,
  });

  const Pass = chip('Pass', () => {
    const exec = inputFlow('exec');
    const input = inputData('input');
    const then = outputFlow('then');
    const output = outputData('output', then);
    wire(exec, then);
    wire(input, output);
  });

  assert({
    given: 'a Pass chip',
    should: 'compile',
    actual: chipCompile(Pass),
    expected: js`
    class Pass {
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

        Object.seal(this.out);

        Object.defineProperties(this.$cont = {}, {
          then: {
            value: () => {
              this.out.output = this.in.input;
              (this.cont.then || (() => {}))();
            }
          }
        });

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

  assert({
    given: 'a Pass chip instance',
    should: 'work as expected',
    actual: withChipClass(new Pass(), (Pass) => {
      const res = [];
      const chip = new Pass();
      res.push(chip.out.output);
      chip.in.input = 'test';
      res.push(chip.out.output);
      chip.exec();
      res.push(chip.out.output);
      return res;
    }),
    expected: [undefined, undefined, 'test'],
  });

  assert({
    given: 'a chip instance with connected outputs (inlet)',
    should: 'compile',
    actual: chipCompile(() => {
      const start = new Start();
      const msg = new Literal('hello world');
      const log = new Log();
      const pass = new Pass();
      pass.id = 'Pass';

      wire(start.out.then, pass.in.exec);
      wire(msg.out.value, pass.in.input);
      wire(pass.out.output, log.in.message);
      wire(pass.out.then, log.in.exec);
    }),
    expected: js`
    class TestChip {
      constructor() {
        let Pass__output;
        Pass__output = "hello world";
        console.log(Pass__output);
      }
    }`,
  });

  assert({
    given: 'a complex inlet usage',
    should: 'compile',
    actual: chipCompile(() => {
      const start = inputFlow('start');
      const msg = inputData('msg');
      const log = new Log();
      const pass = new Pass();
      pass.id = 'Pass';
      const then = outputFlow('then');
      const output = outputData('output');

      wire(start, pass.in.exec);
      wire(pass.out.then, log.in.exec);
      wire(msg, pass.in.input);
      wire(pass.out.output, log.in.message);
      wire(log.out.then, then);
      wire(pass.out.output, output);
    }),
    expected: js`
    class TestChip {
      constructor() {
        this.in = Object.seal({
          msg: undefined
        });

        this.out = {
          output: undefined
        };

        this.cont = Object.seal({
          then: undefined
        });

        let Pass__output;
        Object.seal(this.out);

        Object.defineProperties(this.$cont = {}, {
          then: {
            value: () => {
              this.out.output = Pass__output;
              (this.cont.then || (() => {}))();
            }
          }
        });

        Object.defineProperties(this, {
          start: {
            value: () => {
              Pass__output = this.in.msg;
              console.log(Pass__output);
              this.$cont.then();
            }
          }
        });
      }
    }`,
  });

  assert({
    given: 'a connected output with a compute',
    should: 'compile',
    actual: chipCompile(() => {
      const exec = inputFlow('exec');
      const input = inputData('input');
      const then = outputFlow('then');
      const output = outputData('output', {
        computeOn: then,
        compute: () => input() + 1,
        // TODO support this
        // compute() {
        //   return input() + 1;
        // },
        // TODO and this
        // compute: () => {
        //   return input() + 1;
        // }
      });

      wire(exec, then);
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

        Object.seal(this.out);

        Object.defineProperties(this.$cont = {}, {
          then: {
            value: () => {
              this.out.output = this.in.input + 1;
              (this.cont.then || (() => {}))();
            }
          }
        });

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

// TODO test non connected output (ie: no computeOn and not used by execs) should throw

// TODO test compute with multiple lines
