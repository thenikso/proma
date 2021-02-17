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
import { chipRun, js } from '../utils.mjs';

describe('[run/handlers] handlers basics', async (assert) => {
  assert({
    given: 'a handler used for event binding',
    should: 'run',
    actual: chipRun(
      () => {
        const exec = inputFlow('exec');
        const bind = new BindTest('run-handlers-1');
        const evt = new Evt();
        const pass = new Pass();
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
        const btn = document.createElement('button');
        btn.id = 'run-handlers-1';
        document.body.appendChild(btn);
        let val;
        chip.out.then(() => {
          val = chip.out.val();
        });
        chip.in.exec();
        const evt = new CustomEvent('test-event');
        btn.dispatchEvent(evt);
        btn.remove();
        return val === evt;
      },
    ),
    expected: true,
  });
});

const Evt = chip('Evt', () => {
  const ref = outputHandler('ref', (e) => {
    event(e);
    then();
  });
  const then = outputFlow('then');
  const event = outputData('event');
});

const BindTest = chip('BindTest', () => {
  const exec = inputFlow('exec', () => {
    const t = document.getElementById(target());
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
