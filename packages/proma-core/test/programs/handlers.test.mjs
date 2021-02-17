import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  outputHandler,
  wire,
} from '../../core/index.mjs';
import { chipCompile, js } from '../utils.mjs';
import { Start, Log } from '../../lib/index.mjs';

const Evt = chip('Evt', () => {
  const ref = outputHandler('ref', (e) => {
    event(e);
    then();
  });
  const then = outputFlow('then');
  const event = outputData('event');
});

const BindClick = chip('BindClick', () => {
  const exec = inputFlow('exec', () => {
    const t = document.getElementById(target());
    t.addEventListener('click', event());
    then();
  });
  const target = inputData('target', { canonical: true });
  const event = inputData('event');
  const then = outputFlow('then');
});

describe('[programs/handlers] handlers for events', async (assert) => {
  assert({
    given: 'a handler chip',
    should: 'compile',
    actual: chipCompile(Evt),
    expected: js`
    class Evt {
      constructor() {
        this.out = {
          event: undefined
        };

        this.cont = Object.seal({
          then: undefined
        });

        Object.defineProperties(this.out, {
          ref: {
            enumerable: true,

            get: () => e => {
              this.out.event = e;
              this.$cont.then();
            }
          }
        });

        Object.seal(this.out);

        Object.defineProperties(this.$cont = {}, {
          then: {
            value: () => {
              (this.cont.then || (() => {}))();
            }
          }
        });
      }
    }`,
  });

  assert({
    given: 'a handler used for event binding',
    should: 'compile',
    actual: chipCompile(() => {
      const start = new Start();
      const bind = new BindClick('button');
      const evt = new Evt();
      const log = new Log('clicked!');

      wire(start.out.then, bind.in.exec);
      wire(evt.out.ref, bind.in.event);
      wire(evt.out.then, log.in.exec);
      wire(evt.out.event, log.in.message);
    }),
    expected: js`
    class TestChip {
      constructor() {
        const t = document.getElementById("button");

        t.addEventListener("click", e => {
          let event = e;
          console.log(event);
        });
      }
    }`,
  });
});
