import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';

const Pass = chip('Pass', () => {
  const exec = inputFlow('exec');
  const input = inputData('input', { canonical: true });
  const then = outputFlow('then');
  const output = outputData('output', then);
  wire(exec, then);
  wire(input, output);
});

describe('[core/edit] edit connections', async (assert) => {
  assert({
    given: 'an added in/out flow with connection',
    should: 'edit',
    actual: chip('EditChip')
      .edit()
      .addInputFlowPort('exec')
      .addOutputFlowPort('then')
      .addConnection('exec', 'then')
      .chip.toJSON(),
    expected: {
      URI: 'EditChip',
      inputs: [
        {
          name: 'exec',
          kind: 'flow',
        },
      ],
      outputs: [
        {
          name: 'then',
          kind: 'flow',
        },
      ],
      connections: [
        {
          source: 'then',
          sink: 'exec',
        },
      ],
    },
  });
});

describe('[core/edit] edit sub-chips', async (assert) => {
  const expected = {
    URI: 'EditChip',
    inputs: [
      {
        name: 'exec',
        kind: 'flow',
      },
    ],
    outputs: [
      {
        name: 'then',
        kind: 'flow',
      },
      {
        name: 'value',
        kind: 'data',
        computeOn: ['then'],
      },
    ],
    chips: [
      {
        id: 'Pass',
        chipURI: 'Pass',
        args: ['pass'],
      },
    ],
    connections: [
      {
        source: 'Pass.in.exec',
        sink: 'exec',
      },
      {
        source: 'Pass.out.output',
        sink: 'value',
      },
      {
        source: 'then',
        sink: 'Pass.out.then',
      },
    ],
  };

  assert({
    given: 'a chip instance',
    should: 'add the sub-chip',
    actual: chip('EditChip')
      .edit()
      .addInputFlowPort('exec')
      .addOutputFlowPort('then')
      .addOutputDataPort('value')
      .addChip('Pass', new Pass('pass'))
      .addConnection('exec', '$0.in.exec')
      .addConnection('$0.out.output', 'value')
      .addConnection('$0.out.then', 'then')
      .chip.toJSON(),
    expected,
  });

  assert({
    given: 'a chip class',
    should: 'add the sub-chip',
    actual: chip('EditChip', () => {
      const exec = inputFlow('exec');
      const then = outputFlow('then');
      const value = outputData('value');
    })
      .edit()
      .addChip('Pass', Pass, ['pass'])
      .addConnection('exec', 'Pass.in.exec')
      .addConnection('Pass.out.output', 'value')
      .addConnection('Pass.out.then', 'then')
      .chip.toJSON(),
    expected,
  });
});
