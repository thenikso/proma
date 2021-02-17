import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  outputHandle,
  wire,
} from '../../core/index.mjs';
import { js, compileAndRun, compileAndRunResult } from '../utils.mjs';

const Evt = chip('Evt', () => {
  const ref = outputHandle('ref', (e) => {
    event(e);
    then();
  });
  const then = outputFlow('then');
  const event = outputData('event');
});

if (typeof window === 'undefined') {
  global.bindTargets = {};
} else {
  window.bindTargets = {};
}

const BindTest = chip('BindTest', () => {
  const exec = inputFlow('exec', () => {
    const t = bindTargets[target()];
    t.addEventListener('test-event', event());
    then();
  });
  const target = inputData('target', { canonical: true });
  const event = inputData('event');
  const then = outputFlow('then');
});

const Pass = chip('Pass', () => {
  const exec = inputFlow('exec');
  const input = inputData('input');
  const then = outputFlow('then');
  const output = outputData('output', then);
  wire(exec, then);
  wire(input, output);
});

describe('[programs/handles] handles usage', async (assert) => {
  // assert({
  //   given: 'a handler port',
  //   should: 'define a isHandle property',
  //   actual: compileAndRun(Evt, (chip) => {
  //     return chip.out.ref.isHandle;
  //   }),
  //   expected: true,
  // });

  assert({
    given: 'a handler chip',
    should: 'compile',
    actual: compileAndRun(Evt, (chip) => {
      let val;
      chip.out.then(() => {
        val = chip.out.event();
      });
      const res = [val];
      chip.out.ref()(9);
      res.push(val);
      return res;
    }),
    expected: compileAndRunResult(
      js`
      class Evt {
        constructor() {
          const $out = Object.seal({
            event: undefined,
            then: undefined
          });

          Object.defineProperties(this.out = {}, {
            event: {
              value: () => $out.event
            },

            ref: {
              enumerable: true,

              value: () => e => {
                $out.event = e;
                this.out.then();
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

          Object.seal(this.out);
        }
      }`,
      [undefined, 9],
    ),
  });

  assert({
    given: 'a handler used for event binding',
    should: 'compile',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec');
        const bind = new BindTest('run-handles-1');
        const evt = new Evt();
        const pass = new Pass();
        pass.id = 'Pass';
        const then = outputFlow('then');
        const val = outputData('val', then);

        wire(exec, bind.in.exec);
        wire(evt.out.ref, bind.in.event);
        wire(evt.out.then, pass.in.exec);
        wire(evt.out.event, pass.in.input);
        wire(pass.out.then, then);
        wire(pass.out.output, val);
      },
      (chip) => {
        const btn = new EventTarget();
        bindTargets['run-handles-1'] = btn;
        let val;
        chip.out.then(() => {
          val = chip.out.val();
        });
        chip.in.exec();
        const evt = new Event('test-event');
        btn.dispatchEvent(evt);
        return val === evt;
      },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          const $out = Object.seal({
            val: undefined,
            then: undefined
          });

          let Pass__output;

          Object.defineProperties(this.in = {}, {
            exec: {
              value: () => {
                const t = bindTargets["run-handles-1"];

                t.addEventListener("test-event", e => {
                  let event = e;

                  {
                    Pass__output = event;
                    this.out.then();
                  };
                });
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            val: {
              value: () => $out.val
            },

            then: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.then = value;
                  return;
                }

                $out.val = Pass__output;
                ($out.then || (() => {}))();
              }
            }
          });

          Object.seal(this.out);
        }
      }`,
      true,
    ),
  });
});
