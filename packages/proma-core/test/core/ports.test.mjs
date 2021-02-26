import { describe, Try } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  inputConfig,
  wire,
} from '../../core/index.mjs';
import { js, compileAndRun, compileAndRunResult } from '../utils.mjs';

describe('[core/ports] (input data) canonical ports', async (assert) => {
  assert({
    given: 'a canonical required port',
    should: 'be defined before a canonical non-required one',
    actual: Try(chip, () => {
      const nonRequired = inputData('nonRequired', {
        canonical: true,
      });
      const required = inputData('required', {
        canonical: 'required',
      });
    }),
    expected: new Error(
      'Required canonical inputs must be declared before non-required ones: required',
    ),
  });
});

