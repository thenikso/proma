import { describe } from '../runner/riteway.mjs';
import { Pass } from '../lib.mjs';

describe('[core/run] Running programs', async (assert) => {
  assert({
    given: 'Two instances of the same program',
    should: 'run them separatelly',
    actual: (() => {
      const res = [];
      const pass1 = new Pass();
      const pass2 = new Pass();
      pass1.out.then(() => res.push(pass1.out.output()));
      pass1.in.input = 'pass1-input';
      pass2.in.input = 'pass2-input';
      pass1.in.exec();
      pass2.in.exec();
      return res;
    })(),
    expected: ['pass1-input'],
  });
});
