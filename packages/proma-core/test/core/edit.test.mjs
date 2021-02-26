import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
  registry,
} from '../../core/index.mjs';

const Pass = registry.add(
  chip('test/edit/Pass', () => {
    const exec = inputFlow('exec');
    const input = inputData('input', { canonical: true });
    const then = outputFlow('then');
    const output = outputData('output', then);
    wire(exec, then);
    wire(input, output);
  }),
);

describe('[core/edit] edit connections', async (assert) => {
  assert({
    given: 'an added in/out flow with connection',
    should: 'edit',
    actual: chip('EditChip')
      .edit()
      .addInputFlowPort('exec')
      .addOutputFlowPort('then')
      .addConnection('exec', 'then')
      .Chip.toJSON(),
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
          source: 'exec',
          sink: 'then',
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
        chipURI: 'test/edit/Pass',
        args: ['pass'],
      },
    ],
    connections: [
      {
        source: 'exec',
        sink: 'Pass.in.exec',
      },
      {
        source: 'Pass.out.output',
        sink: 'value',
      },
      {
        source: 'Pass.out.then',
        sink: 'then',
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
      .addChip(new Pass('pass'), 'Pass')
      .addConnection('exec', '$0.in.exec')
      .addConnection('$0.out.output', 'value')
      .addConnection('$0.out.then', 'then')
      .Chip.toJSON(),
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
      .addChip(Pass, ['pass'], 'Pass')
      .addConnection('exec', 'Pass.in.exec')
      .addConnection('Pass.out.output', 'value')
      .addConnection('Pass.out.then', 'then')
      .Chip.toJSON(),
    expected,
  });

  assert({
    given: 'a chip URI',
    should: 'add the sub-chip',
    actual: chip('EditChip', () => {
      const exec = inputFlow('exec');
      const then = outputFlow('then');
      const value = outputData('value');
    })
      .edit()
      .addChip('test/edit/Pass', ['pass'], 'Pass')
      .addConnection('exec', 'Pass.in.exec')
      .addConnection('Pass.out.output', 'value')
      .addConnection('Pass.out.then', 'then')
      .Chip.toJSON(),
    expected,
  });
});
