import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';
import { compileAndRun, compileAndRunResult, js } from '../utils.mjs';

import { Literal } from '../../lib/index.mjs';

describe('[lib/Literal] Literal chip', async (assert) => {
  assert({
    given: 'a Literal chip',
    should: 'compile',
    actual: compileAndRun(
      Literal,
      (chip) => {
        return chip.out.value();
      },
      ['test'],
    ),
    expected: compileAndRunResult(
      js`
      class Literal {
        constructor(value = "test") {
          const $in = Object.seal({
            value
          });

          Object.defineProperties(this.in = {}, {
            value: {
              get: () => () => $in.value,

              set: value => {
                $in.value = value;
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            value: {
              enumerable: true,
              value: () => $in.value
            }
          });

          Object.seal(this.out);
        }
      }`,
      'test',
    ),
  });
});
