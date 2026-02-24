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

  assert({
    given: 'a debugger.snapshot',
    should: 'return all data port values',
    actual: withTestDebugger((d) => {
      const snap = d.snapshot();
      return {
        rootInput: snap['$']['in.input'],
        rootOutput: snap['$']['out.output'],
        passInput: snap['Pass_1']['in.input'],
        passOutput: snap['Pass_1']['out.output'],
        addOutput: snap['Add_1']['out.output'],
      };
    }),
    expected: {
      rootInput: 2,
      rootOutput: 3,
      passInput: 2,
      passOutput: 2,
      addOutput: 3,
    },
  });

  assert({
    given: 'a debugger.ports for root chip',
    should: 'return port details',
    actual: withTestDebugger((d) => {
      const ports = d.ports('$');
      return ports.map((p) => ({ name: p.name, side: p.side, kind: p.kind }));
    }),
    expected: [
      { name: 'exec', side: 'in', kind: 'flow' },
      { name: 'input', side: 'in', kind: 'data' },
      { name: 'output', side: 'out', kind: 'data' },
      { name: 'then', side: 'out', kind: 'flow' },
    ],
  });

  assert({
    given: 'a debugger.watch over execution',
    should: 'capture before and after values',
    actual: (() => {
      const testChip = new TestChip();
      testChip.id = 'TestChip';
      testChip.in.input = 5;
      const d = debug(testChip);

      const watcher = d.watch(['$.in.input', '$.out.output', 'Add_1.out.output']);

      testChip.out.then(() => {
        testChip.out.output();
      });
      testChip.in.exec();

      return watcher.capture();
    })(),
    expected: {
      before: {
        '$.in.input': undefined,
        '$.out.output': undefined,
        'Add_1.out.output': 3,
      },
      after: {
        '$.in.input': 5,
        '$.out.output': 6,
        'Add_1.out.output': 6,
      },
    },
  });
});
