import { describe, Try } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';
import { js, compileAndRun, compileAndRunResult } from '../utils.mjs';

describe('[core/ports] port naming', async (assert) => {
  assert({
    given: 'two input ports with the same name',
    should:
      'throw an error, two ports on the same side can not have the same name',
    actual: Try(chip, () => {
      inputData('value');
      inputData('value');
    }),
    expected: new Error('Port with name "in.value" already exist'),
  });
});

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

  // TODO test that a chip constructed without a required input fails
});

describe('[core/ports] (input data) concealed ports', async (assert) => {
  const LiteralConcealed = chip('test/core/ports/LiteralConcealed', () => {
    const value = inputData('value', {
      canonical: true,
      concealed: true,
    });
    outputData('value', () => value());
  });

  assert({
    given: 'a concealed port',
    should: 'can not be connected but only assigned to',
    actual: Try(chip, () => {
      const input = inputData('input');

      const val = new LiteralConcealed('one');
      val.id = 'val';
      val.in.value = 'two';

      wire(input, val.in.value);
    }),
    expected: new Error('Can not connect to concealed port "val.in.value"'),
  });

  const LiteralHidden = chip('test/core/ports/LiteralHidden', () => {
    const value = inputData('value', {
      canonical: 'required',
      concealed: 'hidden',
    });
    outputData('value', () => value());
  });

  assert({
    given: 'a hidden port while building',
    should: 'can not be assigned to or accessed',
    actual: Try(chip, () => {
      const input = inputData('input');

      const val = new LiteralHidden('one');
      val.id = 'val';

      val.in.value = 'two';
    }),
    expected: new Error('Attempting to access hidden port "value"'),
  });

  assert({
    given: 'a hidden port when running',
    should: 'can not be assigned to or accessed',
    actual: compileAndRun(LiteralHidden, (chip) => {
      try {
        chip.in.value = 'fail';
      } catch (e) {
        return e;
      }
    }),
    expected: compileAndRunResult(
      js`
      class test_core_ports_LiteralHidden {
        constructor(value) {
          const $in = Object.seal({
            value
          });

          Object.defineProperties(this.in = {}, {
            value: {
              get: () => () => $in.value
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            value: {
              enumerable: true,
              value: () => $in.value
            }
          });

          Object.freeze(this.out);

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      new Error('Attempting to access hidden port "value"'),
    ),
  });
});

// TODO variadic check that is the last port (also for outputs)

describe('[core/ports] (output data) concealed ports', async (assert) => {
  const OutputConcealed = chip('test/core/ports/OutputConcealed', () => {
    const value = inputData('value', { canonical: true });
    outputData('value', { compute: () => value(), concealed: true });
  });

  assert({
    given: 'a concealed output port',
    should: 'can not be connected',
    actual: Try(chip, () => {
      const val = new OutputConcealed('one');
      val.id = 'val';

      const output = outputData('output');

      wire(val.out.value, output);
    }),
    expected: new Error('Can not connect to concealed port "val.out.value"'),
  });

  // TODO how to hide this?
  // const OutputHidden = chip('test/core/ports/OutputHidden', () => {
  //   const value = inputData('value', {
  //     canonical: 'required',
  //   });
  //   outputData('value', { compute: () => value(), concealed: 'hidden' });
  // });

  // assert({
  //   given: 'a hidden port while building',
  //   should: 'can not be accessed',
  //   actual: compileAndRun(OutputHidden, (chip) => chip.out.value(), ['test']),
  //   expected: compileAndRunResult(
  //     js``,
  //     undefined,
  //   ),
  // });
});
