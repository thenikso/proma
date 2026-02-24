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

describe('[core/edit] removeOutlet', async (assert) => {
  assert({
    given: 'removeInputOutlet by name',
    should: 'remove the input outlet from the chip',
    actual: edit(
      chip('EditChip', () => {
        inputFlow('exec');
        inputData('value');
        outputFlow('then');
      }),
    )
      .removeInputOutlet('value')
      .Chip.toJSON(),
    expected: {
      URI: 'EditChip',
      in: [{ name: 'exec', kind: 'flow' }],
      out: [{ name: 'then', kind: 'flow' }],
    },
  });

  assert({
    given: 'removeOutputOutlet by name',
    should: 'remove the output outlet from the chip',
    actual: edit(
      chip('EditChip', () => {
        inputFlow('exec');
        outputFlow('then');
        outputData('out');
      }),
    )
      .removeOutputOutlet('out')
      .Chip.toJSON(),
    expected: {
      URI: 'EditChip',
      in: [{ name: 'exec', kind: 'flow' }],
      out: [{ name: 'then', kind: 'flow' }],
    },
  });

  assert({
    given: 'removeOutlet by string name',
    should: 'remove the outlet using dot-path syntax',
    actual: edit(
      chip('EditChip', () => {
        inputFlow('exec');
        inputData('value');
        outputFlow('then');
      }),
    )
      .removeOutlet('in.value')
      .Chip.toJSON(),
    expected: {
      URI: 'EditChip',
      in: [{ name: 'exec', kind: 'flow' }],
      out: [{ name: 'then', kind: 'flow' }],
    },
  });

  assert({
    given: 'removeOutlet on an outlet that has a connection',
    should: 'also remove the connection',
    actual: edit(
      chip('EditChip', () => {
        const exec = inputFlow('exec');
        const then = outputFlow('then');
        wire(exec, then);
      }),
    )
      .removeInputOutlet('exec')
      .Chip.toJSON(),
    expected: {
      URI: 'EditChip',
      out: [{ name: 'then', kind: 'flow' }],
    },
  });

  assert({
    given: 'removeInputOutlet with a non-existent name',
    should: 'throw',
    actual: Try(() => {
      edit(chip('EditChip', () => {})).removeInputOutlet('nonexistent');
    }),
    expected: new Error('No input outlet named "nonexistent"'),
  });

  assert({
    given: 'removeOutputOutlet with a non-existent name',
    should: 'throw',
    actual: Try(() => {
      edit(chip('EditChip', () => {})).removeOutputOutlet('nonexistent');
    }),
    expected: new Error('No output outlet named "nonexistent"'),
  });
});

describe('[core/edit] moveOutlet', async (assert) => {
  assert({
    given: 'moveOutlet moves an input outlet before another (PortOutlet refs)',
    should: 'reorder the inputs array',
    actual: (() => {
      const chipInfo = edit(
        chip('EditChip', () => {
          inputFlow('exec');
          inputData('value');
        }),
      );
      const execOutlet = chipInfo.getPort('in.exec');
      const valueOutlet = chipInfo.getPort('in.value');
      return chipInfo.moveOutlet(valueOutlet, execOutlet).Chip.toJSON();
    })(),
    expected: {
      URI: 'EditChip',
      in: [
        { name: 'value', kind: 'data' },
        { name: 'exec', kind: 'flow' },
      ],
    },
  });

  assert({
    given: 'moveOutlet moves an input outlet before another (dot-path strings)',
    should: 'reorder the inputs array',
    actual: edit(
      chip('EditChip', () => {
        inputFlow('exec');
        inputData('value');
      }),
    )
      .moveOutlet('in.value', 'in.exec')
      .Chip.toJSON(),
    expected: {
      URI: 'EditChip',
      in: [
        { name: 'value', kind: 'data' },
        { name: 'exec', kind: 'flow' },
      ],
    },
  });

  assert({
    given: 'moveOutlet with no beforePort',
    should: 'move the outlet to the end',
    actual: edit(
      chip('EditChip', () => {
        inputFlow('exec');
        inputData('value');
      }),
    )
      .moveOutlet('in.exec')
      .Chip.toJSON(),
    expected: {
      URI: 'EditChip',
      in: [
        { name: 'value', kind: 'data' },
        { name: 'exec', kind: 'flow' },
      ],
    },
  });

  assert({
    given: 'moveOutlet moves an output outlet before another',
    should: 'reorder the outputs array',
    actual: edit(
      chip('EditChip', () => {
        outputFlow('then');
        outputData('result');
      }),
    )
      .moveOutlet('out.result', 'out.then')
      .Chip.toJSON(),
    expected: {
      URI: 'EditChip',
      out: [
        { name: 'result', kind: 'data' },
        { name: 'then', kind: 'flow' },
      ],
    },
  });

  assert({
    given: 'moveOutlet with port === beforePort',
    should: 'be a no-op',
    actual: edit(
      chip('EditChip', () => {
        inputFlow('exec');
        inputData('value');
      }),
    )
      .moveOutlet('in.exec', 'in.exec')
      .Chip.toJSON(),
    expected: {
      URI: 'EditChip',
      in: [
        { name: 'exec', kind: 'flow' },
        { name: 'value', kind: 'data' },
      ],
    },
  });

  assert({
    given: 'moveOutlet with beforePort on wrong side',
    should: 'throw',
    actual: Try(() => {
      edit(
        chip('EditChip', () => {
          inputFlow('exec');
          outputFlow('then');
        }),
      ).moveOutlet('in.exec', 'out.then');
    }),
    expected: new Error('Cannot move outlet across sides (input/output)'),
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
