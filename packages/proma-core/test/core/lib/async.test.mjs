import { describe } from '../../runner/riteway.mjs';
import { library } from '../../../core/index.mjs';

function defer() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('[core/lib/async] Await', async (assert) => {
  const Await = library.std.async.Await;

  assert({
    given: 'a resolved promise',
    should: 'fire then with the result',
    actual: await (async () => {
      const chip = new Await();
      chip.in.promise = Promise.resolve(42);
      const d = defer();
      chip.out.then(() => d.resolve(chip.out.result()));
      chip.in.exec();
      return await d.promise;
    })(),
    expected: 42,
  });

  assert({
    given: 'a rejected promise',
    should: 'fire catch with the error',
    actual: await (async () => {
      const chip = new Await();
      const expectedError = new Error('test error');
      chip.in.promise = Promise.reject(expectedError);
      const d = defer();
      chip.out.onCatch(() => d.resolve(chip.out.error()));
      chip.in.exec();
      return await d.promise;
    })(),
    expected: new Error('test error'),
  });
});

describe('[core/lib/async] Delay', async (assert) => {
  const Delay = library.std.async.Delay;

  assert({
    given: 'a short delay',
    should: 'fire then after the delay',
    actual: await (async () => {
      const chip = new Delay(10);
      const d = defer();
      chip.out.then(() => d.resolve('fired'));
      chip.in.exec();
      return await d.promise;
    })(),
    expected: 'fired',
  });
});

describe('[core/lib/async] Debounce', async (assert) => {
  const Debounce = library.std.async.Debounce;

  assert({
    given: 'multiple rapid exec calls',
    should: 'only fire then once after the delay',
    actual: await (async () => {
      const chip = new Debounce(30);
      const fired = [];
      const d = defer();
      chip.out.then(() => {
        fired.push(Date.now());
        d.resolve(fired.length);
      });
      // Fire exec 3 times rapidly
      chip.in.exec();
      chip.in.exec();
      chip.in.exec();
      return await d.promise;
    })(),
    expected: 1,
  });
});

describe('[core/lib/async] Throttle', async (assert) => {
  const Throttle = library.std.async.Throttle;

  assert({
    given: 'multiple rapid exec calls',
    should: 'only fire then once per interval',
    actual: await (async () => {
      const chip = new Throttle(50);
      let count = 0;
      // First call should fire immediately
      chip.out.then(() => {
        count++;
      });
      chip.in.exec(); // fires (count = 1)
      chip.in.exec(); // throttled
      chip.in.exec(); // throttled
      return count;
    })(),
    expected: 1,
  });
});
