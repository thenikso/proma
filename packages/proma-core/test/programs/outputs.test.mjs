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

describe('[programs/outputs] pure outputs', async (assert) => {
  assert({
    given: 'a pure output',
    should: 'compile',
    actual: compileAndRun(
      () => {
        const A = inputData('A');
        const B = inputData('B');
        const value = outputData('value', () => A() + B());
      },
      (chip) => {
        chip.in.A = 1;
        chip.in.B = 2;
        return chip.out.value();
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $in = Object.seal({
            A: undefined,
            B: undefined
          });

          Object.defineProperties(this.in = {}, {
            A: {
              get: () => () => $in.A,

              set: value => {
                $in.A = value;
              }
            },

            B: {
              get: () => () => $in.B,

              set: value => {
                $in.B = value;
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            value: {
              enumerable: true,
              value: () => $in.A + $in.B
            }
          });

          Object.freeze(this.out);

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      3,
    ),
  });

  // TODO can only have input ports
});

describe('[programs/outputs] executed outputs', async (assert) => {
  assert({
    given: 'an output set in the exec',
    should: 'compile',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec', () => {
          value(Math.random());
          then();
        });
        const then = outputFlow('then');
        const value = outputData('value');
      },
      (chip) => {
        chip.in.exec();
        return typeof chip.out.value();
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $out = Object.seal({
            value: undefined,
            then: undefined
          });

          Object.defineProperties(this.in = {}, {
            exec: {
              value: () => {
                $out.value = Math.random();
                this.out.then();
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            value: {
              value: () => $out.value
            },

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

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      'number',
    ),
  });

  // TODO output port should not have its out compile
});

describe('[programs/outputs] connected outputs (and inlets)', async (assert) => {
  const connectedOutputExpected = js`class TestChip {
    constructor() {
      const $out = Object.seal({
        output: undefined,
        then: undefined
      });

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

            $out.output = "hello world";
            ($out.then || (() => {}))();
          }
        }
      });

      Object.freeze(this.out);

      {
        console.log("hello world");
        this.out.then();
      }

      Object.defineProperty(this, "destroy", {
        value: () => {}
      });
    }
  }`;

  assert({
    given: 'an output connected with array of output flow',
    should: 'compile',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const msg = new Literal('hello world');
      const log = new Log();
      const then = outputFlow('then');
      const output = outputData('output', [then]);

      wire(onCreate.out.then, log.in.exec);
      wire(msg.out.value, log.in.message);
      wire(log.out.then, then);
      wire(msg.out.value, output);
    }),
    expected: compileAndRunResult(connectedOutputExpected, ['hello world']),
  });

  assert({
    given: 'an output connected with just one output flow',
    should: 'compile',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const msg = new Literal('hello world');
      const log = new Log();
      const then = outputFlow('then');
      const output = outputData('output', then);

      wire(onCreate.out.then, log.in.exec);
      wire(msg.out.value, log.in.message);
      wire(log.out.then, then);
      wire(msg.out.value, output);
    }),
    expected: compileAndRunResult(connectedOutputExpected, ['hello world']),
  });

  assert({
    given: 'an output connected with nothing (auto-connection)',
    should: 'compile',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const msg = new Literal('hello world');
      const log = new Log();
      const then = outputFlow('then');
      const output = outputData('output');

      wire(onCreate.out.then, log.in.exec);
      wire(msg.out.value, log.in.message);
      wire(log.out.then, then);
      wire(msg.out.value, output);
    }),
    expected: compileAndRunResult(connectedOutputExpected, ['hello world']),
  });

  const PushLiteral = chip('test/programs/outputs/PushLiterla', () => {
    const exec = inputFlow('exec', () => {
      output(value());
      then();
    });
    const value = inputData('value', true);

    const then = outputFlow('then');
    const output = outputData('output');
  });

  assert({
    given: 'an output connected manually (pushed by an exec)',
    should: 'compile',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const msg = new PushLiteral('hello world');
      const log = new Log();
      const then = outputFlow('then');
      const output = outputData('output', then);

      wire(onCreate.out.then, msg.in.exec);
      wire(msg.out.then, log.in.exec);
      wire(msg.out.output, log.in.message);
      wire(log.out.then, then);
      wire(msg.out.output, output);
    }),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $out = Object.seal({
            output: undefined,
            then: undefined
          });

          let test_programs_outputs_PushLiterla_1__output;

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

                ($out.then || (() => {}))();
              }
            }
          });

          Object.freeze(this.out);

          {
            test_programs_outputs_PushLiterla_1__output = "hello world";
            $out.output = "hello world";

            {
              console.log(test_programs_outputs_PushLiterla_1__output);
              this.out.then();
            };
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['hello world'],
    ),
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
    actual: compileAndRun(Pass, (chip) => {
      chip.in.input = 7;
      const res = [chip.out.output()];
      chip.in.exec();
      res.push(chip.out.output());
      return res;
    }),
    expected: compileAndRunResult(
      js`
      class Pass {
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

                $out.output = $in.input;
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
      [undefined, 7],
    ),
  });

  assert({
    given: 'a chip instance with connected outputs (inlet)',
    should: 'compile',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const msg = new Literal('hello world');
      const log = new Log();
      const pass = new Pass();
      pass.id = 'Pass';

      wire(onCreate.out.then, pass.in.exec);
      wire(msg.out.value, pass.in.input);
      wire(pass.out.output, log.in.message);
      wire(pass.out.then, log.in.exec);
    }),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          let Pass__output;

          {
            Pass__output = "hello world";
            console.log(Pass__output);
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['hello world'],
    ),
  });

  assert({
    given: 'a complex inlet usage',
    should: 'compile',
    actual: compileAndRun(
      () => {
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
      },
      (chip) => {
        chip.in.msg = 'test-msg';
        chip.in.start();
        return chip.out.output();
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $in = Object.seal({
            msg: undefined
          });

          const $out = Object.seal({
            output: undefined,
            then: undefined
          });

          let Pass__output;

          Object.defineProperties(this.in = {}, {
            msg: {
              get: () => () => $in.msg,

              set: value => {
                $in.msg = value;
              }
            },

            start: {
              value: () => {
                Pass__output = $in.msg;
                console.log(Pass__output);
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

                $out.output = Pass__output;
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
      'test-msg',
    ),
  });

  assert({
    given: 'a connected output with a compute',
    should: 'compile',
    actual: compileAndRun(
      () => {
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
      },
      (chip) => {
        chip.in.input = 7;
        const res = [chip.out.output()];
        chip.in.exec();
        res.push(chip.out.output());
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

                $out.output = $in.input + 1;
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
      [undefined, 8],
    ),
  });
});

// TODO test non connected output (ie: no computeOn and not used by execs) should throw

// TODO test compute with multiple lines

describe.only('[programs/outputs] state outputs', async (assert) => {
  assert({
    given: 'an output in read and write',
    should: 'compile as expected',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec', () => {
          count(count() + 1);
          then();
        });
        const reset = inputFlow('reset', () => {
          count(0);
        });

        const then = outputFlow('then');
        const count = outputData('count', {
          defaultValue: 0,
          // conceiled: 'hidden',
        });
      },
      (chip) => {
        const counts = [];
        chip.out.then(() => counts.push(chip.out.count()));
        chip.in.exec();
        chip.in.exec();
        chip.in.reset();
        chip.in.exec();
        return counts;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $out = Object.seal({
            count: 0,
            then: undefined
          });

          Object.defineProperties(this.in = {}, {
            exec: {
              value: () => {
                $out.count = $out.count + 1;
                this.out.then();
              }
            },

            reset: {
              value: () => {
                $out.count = 0;
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            count: {
              value: () => $out.count
            },

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

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`, [1, 2, 1]),
  });
});
