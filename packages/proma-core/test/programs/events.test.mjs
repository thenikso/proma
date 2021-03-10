import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
  event,
  externalGet,
} from '../../core/index.mjs';
import { js, compileAndRun, compileAndRunResult } from '../utils.mjs';
import { Log } from '../lib.mjs';

describe('[programs/events] events binding', async (assert) => {
  const BIND_TARGET = { value: undefined };

  const GetTarget = externalGet({ BIND_TARGET });

  const Bind = chip('test/program/events/Bind', () => {
    const exec = inputFlow('exec', () => {
      target().value.addEventListener(event(), listener());
      then();
    });
    const target = inputData('target');
    const event = inputData('event', true);
    const listener = inputData('listener');
    const then = outputFlow('then');
  });

  const Listener = event('TestEvent', 'event');

  assert({
    given: 'a bound event',
    should: 'trigger',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec');

        const bind = new Bind('test-event');
        const target = new GetTarget();
        wire(target.out.value, bind.in.target);
        const listener = new Listener();
        wire(listener.out.handle, bind.in.listener);

        wire(exec, bind.in.exec);

        const then = outputFlow('then');
        const output = outputData('output');
        wire(listener.out.then, then);
        wire(listener.out.event, output);
      },
      (chip) => {
        const res = [];
        const t = (BIND_TARGET.value = new EventTarget());
        t.dispatchEvent(new Event('test-event'));
        chip.out.then(() => {
          res.push(chip.out.output().type);
        });
        chip.in.exec();
        t.dispatchEvent(new Event('test-event'));
        t.dispatchEvent(new Event('test-event'));
        return res;
      },
      null,
      {
        BIND_TARGET,
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

          const TestEvent_1__handle = (...args) => {
            $out.output = args[0];
            this.out.then();
          };

          Object.defineProperties(this.in = {}, {
            exec: {
              value: () => {
                BIND_TARGET.value.addEventListener("test-event", TestEvent_1__handle);
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
      ['test-event', 'test-event'],
    ),
  });
});
