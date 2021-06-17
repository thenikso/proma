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

function defer() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('[programs/async] async executions', async (assert) => {
  assert({
    given: 'an async execute function',
    should: 'compile and run',
    actual: await compileAndRun(
      () => {
        const exec = inputFlow('exec', async () => {
          await Promise.resolve();
          console.log(message());
          then();
        });
        const message = inputData('message', { canonical: true });
        const then = outputFlow('then');
      },
      async (chip, logs) => {
        const deferred = defer();
        chip.out.then(deferred.resolve);
        chip.in.exec();
        await deferred.promise;
        return logs;
      },
      ['test message 1'],
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor(message = "test message 1") {
          const $in = Object.seal({
            message
          });

          const $out = Object.seal({
            then: undefined
          });

          Object.defineProperties(this.in = {}, {
            message: {
              get: () => () => $in.message,

              set: value => {
                $in.message = value;
              }
            },

            exec: {
              value: () => {
                (async () => {
                  await Promise.resolve();
                  console.log($in.message);
                  this.out.then();
                })();
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
      ['test message 1'],
    ),
  });

  assert({
    given: 'an execute function returning a promise',
    should: 'compile and run',
    actual: await compileAndRun(
      () => {
        const exec = inputFlow('exec', () => {
          Promise.resolve().then(() => {
            console.log(message());
            then();
          });
        });
        const message = inputData('message', { canonical: true });
        const then = outputFlow('then');
      },
      async (chip, logs) => {
        const deferred = defer();
        chip.out.then(deferred.resolve);
        chip.in.exec();
        await deferred.promise;
        return logs;
      },
      ['test message 2'],
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor(message = "test message 2") {
          const $in = Object.seal({
            message
          });

          const $out = Object.seal({
            then: undefined
          });

          Object.defineProperties(this.in = {}, {
            message: {
              get: () => () => $in.message,

              set: value => {
                $in.message = value;
              }
            },

            exec: {
              value: () => {
                Promise.resolve().then(() => {
                  console.log($in.message);
                  this.out.then();
                });
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
      ['test message 2'],
    ),
  });
});
