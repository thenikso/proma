import { describe, Try } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
  registry,
  edit,
} from '../../core/index.mjs';

import { Pass, Log, Literal } from '../lib.mjs';

const testRegistry = registry.copy.add(Pass, 'test/edit');

describe('[core/edit] edit connections', async (assert) => {
  assert({
    given: 'an added in/out flow with connection',
    should: 'edit',
    actual: edit(chip('EditChip'))
      .addInputFlowOutlet('exec')
      .addOutputFlowOutlet('then')
      .addConnection('exec', 'then')
      .Chip.toJSON(),
    expected: {
      URI: 'EditChip',
      in: [
        {
          name: 'exec',
          kind: 'flow',
        },
      ],
      out: [
        {
          name: 'then',
          kind: 'flow',
        },
      ],
      connections: [
        {
          source: 'in.exec',
          sink: 'out.then',
        },
      ],
    },
  });
});

describe('[core/edit] edit sub-chips', async (assert) => {
  const expected = {
    URI: 'EditChip',
    in: [
      {
        name: 'exec',
        kind: 'flow',
      },
    ],
    out: [
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
        chipURI: 'test/edit#Pass',
        args: ['pass'],
      },
    ],
    connections: [
      {
        source: 'in.exec',
        sink: 'Pass.in.exec',
      },
      {
        source: 'Pass.out.output',
        sink: 'out.value',
      },
      {
        source: 'Pass.out.then',
        sink: 'out.then',
      },
    ],
  };

  assert({
    given: 'a chip instance',
    should: 'add the sub-chip',
    actual: edit(chip('EditChip'), testRegistry)
      .addInputFlowOutlet('exec')
      .addOutputFlowOutlet('then')
      .addOutputDataOutlet('value')
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
    actual: edit(
      chip('EditChip', () => {
        const exec = inputFlow('exec');
        const then = outputFlow('then');
        const value = outputData('value');
      }),
      testRegistry,
    )
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
    actual: edit(
      chip('EditChip', () => {
        const exec = inputFlow('exec');
        const then = outputFlow('then');
        const value = outputData('value');
      }),
      testRegistry,
    )
      .addChip('test/edit#Pass', ['pass'], 'Pass')
      .addConnection('exec', 'Pass.in.exec')
      .addConnection('Pass.out.output', 'value')
      .addConnection('Pass.out.then', 'then')
      .Chip.toJSON(),
    expected,
  });
});

describe('[core/edit] edit ports', async (assert) => {
  assert({
    given: 'a port rename operation',
    should: 'rename the outlet port',
    actual: edit(
      chip('EditChip', () => {
        const exec = inputFlow('exec');
        const inValue = inputData('value');
        const then = outputFlow('then');
        const outValue = outputData('value');
        wire(inValue, outValue);
      }),
    )
      .renameOutlet('in.value', 'input')
      .Chip.toJSON(),
    expected: {
      URI: 'EditChip',
      in: [
        {
          name: 'exec',
          kind: 'flow',
        },
        {
          name: 'input',
          kind: 'data',
        },
      ],
      out: [
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
      connections: [
        {
          source: 'in.input',
          sink: 'out.value',
        },
      ],
    },
  });

  assert({
    given: 'a port rename with invalid name',
    should: 'throw',
    actual: Try(() => {
      edit(
        chip('EditChip', () => {
          const exec = inputFlow('exec');
          const inValue = inputData('value');
          const then = outputFlow('then');
          const outValue = outputData('value');
          wire(inValue, outValue);
        }),
      )
        // NOTE the last `true` param is for "dry run". It can be used to check
        // if a rename operation would succeed
        .renameOutlet('in.value', 'exec', true);
    }),
    expected: new Error('Port with name "in.exec" already exist'),
  });
});

describe('[core/edit] edit uses', async (assert) => {
  testRegistry
    .resolver(/^use-log/, (add) => {
      add(Log, 'use-log');
    })
    .resolver(/^use-literal/, (add) => {
      add(Literal, 'use-literal');
    });

  assert({
    given: 'a `addUse` operation',
    should: 'add the use to the chip',
    actual: (await edit(chip('EditChip'), testRegistry).addUse('use-log')).Chip
      .uses,
    expected: ['use-log'],
  });

  assert({
    given: 'a `removeUse` operation',
    should: 'remove the use from the chip',
    actual: await (async () => {
      const e = edit(chip('EditChip'), testRegistry);
      await e.addUse('use-log');
      await e.addUse('use-literal');
      e.removeUse('use-log');
      return e.Chip.uses;
    })(),
    expected: ['use-literal'],
  });
});
