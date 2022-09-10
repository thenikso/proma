import { describe } from '../runner/riteway.mjs';
import { compileAndRun } from '../utils.mjs';
import {
  debug,
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';

import { Pass, Literal, Add } from '../lib.mjs';

const TestChip = chip('TestChip', () => {
  const exec = inputFlow('exec');
  const input = inputData('input', { canonical: true, type: 'Number' });

  const one = new Literal(1);
  const pass = new Pass(0);
  const add = new Add();

  const output = outputData('output');
  const then = outputFlow('then');

  wire(input, pass.in.input);
  wire(exec, pass.in.exec);
  wire(pass.out.output, add.in.A);
  wire(one.out.value, add.in.B);
  wire(add.out.output, output);
  wire(pass.out.then, then);
});

describe('[core/debug] debug chip instances', async (assert) => {
  function withTestDebugger(f) {
    const testChip = new TestChip();
    testChip.id = 'TestChip';
    let out;
    testChip.in.input = 2;
    testChip.out.then(() => {
      out = testChip.out.output();
    });
    testChip.in.exec();

    const debugChip = debug(testChip);

    return f(debugChip, testChip, out);
  }

  assert({
    given: 'a debugger.chipIds',
    should: 'returns ids of the sub-chips',
    actual: withTestDebugger((d) => d.chipIds),
    expected: ['Literal_1', 'Pass_1', 'Add_1'],
  });

  assert({
    given: 'a debugger.runValue',
    should: 'returns values of sub-chips ports',
    actual: withTestDebugger((d) => [
      d.runValue('TestChip', 'in', 'input'),
      d.runValue('Literal_1', 'out', 'value'),
      d.runValue('Pass_1.in.input'),
      d.runValue('Pass_1.out.output'),
      d.runValue('Add_1.in.A'),
      d.runValue('Add_1.in.B'),
      d.runValue('Add_1.out.output'),
      d.runValue('$.out.output'),
    ]),
    expected: [2, 1, 2, 2, 2, 1, 3, 3],
  });
});
