import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';
import { chipCompile, js } from '../utils.mjs';

import { Literal } from '../../lib/index.mjs';

describe('[lib/Literal] Literal chip', async (assert) => {
  assert({
    given: 'a Literal chip',
    should: 'compile',
    actual: new Literal('test').compile(),
    expected: js`
    class Literal {
      constructor(value = "test") {
        this.in = Object.seal({
          value
        });

        this.out = {};

        Object.defineProperties(this.out, {
          value: {
            enumerable: true,
            get: () => this.in.value
          }
        });

        Object.seal(this.out);
      }
    }`,
  });
});
