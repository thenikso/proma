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

describe('[core/lib/flowControl] If', async (assert) => {
  assert({
    given: 'an If chip',
    should: 'compile and run',
    actual: compileAndRun(lib.flowControl.If, (chip) => {
      const res = [];
      chip.out.whenTrue(() => res.push(true));
      chip.out.whenFalse(() => res.push(false));
      chip.in.exec();
      chip.in.condition = true;
      chip.in.exec();
      chip.in.exec();
      chip.in.condition = false;
      chip.in.exec();
      return res;
    }),
    expected: compileAndRunResult(
      js`
      class lib_flowControl_If {
        constructor(condition) {
          const $in = Object.seal({
            condition: condition || false
          });

          const $out = Object.seal({
            whenTrue: undefined,
            whenFalse: undefined
          });

          Object.defineProperties(this.in = {}, {
            condition: {
              get: () => () => $in.condition,

              set: value => {
                $in.condition = value;
              }
            },

            exec: {
              value: () => {
                if ($in.condition) {
                  this.out.whenTrue();
                } else {
                  this.out.whenFalse();
                }
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            whenTrue: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.whenTrue = value;
                  return;
                }

                ($out.whenTrue || (() => {}))();
              }
            },

            whenFalse: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.whenFalse = value;
                  return;
                }

                ($out.whenFalse || (() => {}))();
              }
            }
          });

          Object.freeze(this.out);

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      [false, true, true, false],
    ),
  });

  assert({
    given: 'an If usage with only whenTrue connected',
    should: 'not compile the else branch',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec');
        const input = inputData('input', { defaultValue: false });

        const branch = new lib.flowControl.If();

        const then = outputFlow('then');

        wire(exec, branch.in.exec);
        wire(input, branch.in.condition);
        wire(branch.out.whenTrue, then);
      },
      (chip) => {
        const res = [];
        chip.out.then(() => res.push('x'));
        chip.in.exec();
        chip.in.input = true;
        chip.in.exec();
        chip.in.exec();
        chip.in.input = false;
        chip.in.exec();
        return res;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $in = Object.seal({
            input: false
          });

          const $out = Object.seal({
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
                if ($in.input) {
                  this.out.then();
                }
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

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['x', 'x'],
    ),
  });
});

describe('[core/lib/flowControl] Sequence', async (assert) => {
  assert({
    given: 'a Sequence usage',
    should: 'compile and run',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec');

        const seq = new lib.flowControl.Sequence();
        seq.id = 'Sequence';

        const first = outputFlow('first');
        const second = outputFlow('second');

        wire(exec, seq.in.exec);
        wire(seq.out.then0, first);
        wire(seq.out.then1, second);
      },
      (chip) => {
        const res = [];
        chip.out.first(() => res.push('first'));
        chip.out.second(() => res.push('second'));
        chip.in.exec();
        chip.in.exec();
        return res;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $out = Object.seal({
            first: undefined,
            second: undefined
          });

          const Sequence__then0 = () => this.out.first();
          const Sequence__then1 = () => this.out.second();

          Object.defineProperties(this.in = {}, {
            exec: {
              value: () => {
                Sequence__then0();
                Sequence__then1();
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            first: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.first = value;
                  return;
                }

                ($out.first || (() => {}))();
              }
            },

            second: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.second = value;
                  return;
                }

                ($out.second || (() => {}))();
              }
            }
          });

          Object.freeze(this.out);

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['first', 'second', 'first', 'second'],
    ),
  });

  // TODO modify to await async functions and make it an actual sequence?
});

describe('[core/lib/flowControl] ForLoop', async (assert) => {
  assert({
    given: 'a ForLoop usage',
    should: 'compile and run',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec');

        const loop = new lib.flowControl.ForLoop(1, 4);
        loop.id = 'ForLoop';

        const done = outputFlow('done');
        const then = outputFlow('then');
        const index = outputData('index');

        wire(exec, loop.in.exec);
        wire(loop.out.loopBody, then);
        wire(loop.out.index, index);
        wire(loop.out.completed, done);
      },
      (chip) => {
        const res = [];
        chip.out.then(() => res.push(chip.out.index()));
        chip.out.done(() => res.push('done'));
        chip.in.exec();
        chip.in.exec();
        return res;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $out = Object.seal({
            index: undefined,
            done: undefined,
            then: undefined
          });

          Object.defineProperties(this.in = {}, {
            exec: {
              value: () => {
                for (let i = 1, l = 4; i < l; i++) {
                  $out.index = i;
                  this.out.then();
                }

                this.out.done();
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            index: {
              value: () => $out.index
            },

            done: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.done = value;
                  return;
                }

                ($out.done || (() => {}))();
              }
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
      [1, 2, 3, 'done', 1, 2, 3, 'done'],
    ),
  });
});

describe('[core/lib/flowControl] WhileLoop', async (assert) => {
  assert({
    given: 'a WhileLoop usage',
    should: 'compile and run',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec');
        const input = inputData('input', { defaultValue: false });

        const loop = new lib.flowControl.WhileLoop();
        loop.id = 'WhileLoop';

        const done = outputFlow('done');
        const then = outputFlow('then');

        wire(exec, loop.in.exec);
        wire(input, loop.in.condition);
        wire(loop.out.loopBody, then);
        wire(loop.out.completed, done);
      },
      (chip) => {
        const res = [];
        chip.out.then(() => {
          res.push('x');
          if (res.length > 3) {
            chip.in.input = false;
          }
        });
        chip.out.done(() => res.push('done'));
        chip.in.input = true;
        chip.in.exec();
        return res;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $in = Object.seal({
            input: false
          });

          const $out = Object.seal({
            done: undefined,
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
                while ($in.input) {
                  this.out.then();
                }

                this.out.done();
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            done: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.done = value;
                  return;
                }

                ($out.done || (() => {}))();
              }
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
      ['x', 'x', 'x', 'x', 'done'],
    ),
  });
});
