import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';
import { chipEmitters, js } from '../utils.mjs';
import { Start, Split, Log } from '../../lib/index.mjs';

describe('[programs/emitters] emitter base flow', async (assert) => {
  assert({
    given: 'a direct emitter based program',
    should: 'compile',
    actual: chipEmitters(() => {
      const start = new Start();
      const log = new Log();
      log.in.message = 'hello world';
      wire(start.out.then, log.in.exec);
    }),
    expected: js`console.log("hello world");`,
  });

  assert({
    given: 'wrapped chips',
    should: 'reduce to non wrapped versions',
    actual: chipEmitters(() => {
      const start = new WStart();
      const log = new WLog();
      log.in.message = 'hello world';
      wire(start.out.then, log.in.exec);
    }),
    expected: js`console.log("hello world");`,
  });

  assert({
    given: 'a sequence',
    should: 'compile both branch sequentially',
    actual: chipEmitters(() => {
      const start = new Start();
      const log1 = new Log();
      log1.in.message = 'one';
      const log2 = new WLog();
      log2.in.message = 'two';
      const split = new Split();
      wire(start.out.then, split.in.exec);
      wire(split.out.then1, log1.in.exec);
      wire(split.out.then2, log2.in.exec);
    }),
    expected: js`
    console.log("one");
    console.log("two");
    `,
  });
});

const WStart = chip('WStart', () => {
  const then = outputFlow('then');

  const start = new Start();

  wire(start.out.then, then);
});

const WLog = chip('WLog', () => {
  const exec = inputFlow('exec');
  const message = inputData('message');

  const log = new Log();

  const then = outputFlow('then');

  wire(exec, log.in.exec);
  wire(message, log.in.message);
  wire(log.out.then, then);
});
