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
import { Split, Log } from '../lib.mjs';

describe('[programs/hooks] onCreate hook', async (assert) => {
  assert({
    given: 'a direct onCreate hook based program',
    should: 'compile',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const log = new Log();
      log.in.message = 'hello world';
      wire(onCreate.out.then, log.in.exec);
    }),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          {
            console.log("hello world");
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
    given: 'wrapped chips',
    should: 'reduce to non wrapped versions',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const log = new WLog();
      log.in.message = 'hello world';
      wire(onCreate.out.then, log.in.exec);
    }),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          {
            console.log("hello world");
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
    given: 'a sequence',
    should: 'compile both branch sequentially',
    actual: compileAndRun(({ OnCreate }) => {
      const onCreate = new OnCreate();
      const log1 = new Log();
      log1.in.message = 'one';
      const log2 = new WLog();
      log2.in.message = 'two';
      const split = new Split();
      wire(onCreate.out.then, split.in.exec);
      wire(split.out.then1, log1.in.exec);
      wire(split.out.then2, log2.in.exec);
    }),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          {
            console.log("one");
            console.log("two");
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['one', 'two'],
    ),
  });
});

const WStart = chip('WStart', ({ OnCreate }) => {
  const onCreate = new OnCreate();
  const then = outputFlow('then');

  wire(onCreate.out.then, then);
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
