import { describe } from '../runner/riteway.mjs';
import {
  Chip,
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
  inputConfig,
  outputHandle,
} from '../../core/index.mjs';
import { js, compileAndRun, compileAndRunResult } from '../utils.mjs';

const Pass = chip('test/serialize/Pass', () => {
  const exec = inputFlow('exec');
  const input = inputData('input', { canonical: true });
  const then = outputFlow('then');
  const output = outputData('output', then);
  wire(exec, then);
  wire(input, output);
});

const chipJSON = {
  URI: 'TestChipSerialize',
  inputs: [
    {
      name: 'exec',
      kind: 'flow',
    },
    {
      name: 'input',
      kind: 'data',
      canonical: true,
      defaultValue: 3,
    },
    {
      name: 'conf',
      kind: 'data',
      canonical: true,
      conceiled: true,
      defaultValue: true,
    },
  ],
  outputs: [
    {
      name: 'then',
      kind: 'flow',
    },
    {
      name: 'output',
      kind: 'data',
      computeOn: ['then'],
    },
    {
      name: 'handle',
      kind: 'data',
      compute: '() => (o) => {\n        output(o);\n        then();\n      }',
      inline: 'once',
    },
  ],
  chips: [
    {
      id: 'Pass',
      chipURI: 'test/serialize/Pass',
      args: ['pass-input'],
    },
  ],
  connections: [
    {
      source: 'Pass.in.exec',
      sink: 'exec',
    },
    {
      source: 'then',
      sink: 'Pass.out.then',
    },
    {
      source: 'input',
      sink: 'Pass.in.input',
    },
    {
      source: 'Pass.out.output',
      sink: 'output',
    },
  ],
};

describe('[core/serialize] to JSON', async (assert) => {
  assert({
    given: 'a chip',
    should: 'serialize to JSON',
    actual: chip('TestChipSerialize', () => {
      const exec = inputFlow('exec');
      const input = inputData('input', { canonical: true, defaultValue: 3 });
      const conf = inputConfig('conf', true);

      const pass = new Pass('pass-input');
      pass.id = 'Pass';

      const then = outputFlow('then');
      const output = outputData('output');
      const handle = outputHandle('handle', (o) => {
        output(o);
        then();
      });

      wire(exec, pass.in.exec);
      wire(pass.out.then, then);
      wire(input, pass.in.input);
      wire(pass.out.output, output);
    }).toJSON(),
    expected: chipJSON,
  });
});

describe('[core/serialize] from JSON', async (assert) => {
  assert({
    given: 'a chip in JSON format',
    should: 'deserialize to a Chip class',
    actual: chip.fromJSON(chipJSON).__proto__,
    expected: Chip,
  });

  assert({
    given: 'a chip from JSON',
    should: 'have a ready state',
    actual: chip.fromJSON(chipJSON).isReady,
    expected: true,
  });

  assert({
    given: 'a chip from JSON',
    should: 'wait for it to be ready',
    actual: await chip.fromJSON(chipJSON).ready,
    expected: true,
  });

  assert({
    given: 'a chip from JSON',
    should: 'compile and run',
    actual: compileAndRun(chip.fromJSON(chipJSON), (chip) => {
      const res = [];
      chip.out.then(() => {
        res.push(chip.out.output());
      });
      chip.in.exec();
      chip.in.input = 7;
      chip.in.exec();
      chip.out.handle()(9);
      return res;
    }),
    expected: compileAndRunResult(js``, [3, 7, 9]),
  });
});

describe('[core/serialize] from JSON with async chips', async (assert) => {
  const asyncChipJSON = {
    ...chipJSON,
    chips: [
      {
        id: 'Pass',
        chipURI: 'test/serialize/PassAsync',
      },
    ],
  };

  promaRegistry.addResolver({
    test: /^test\/serialize\/(PassAsync)$/,
    load(chipUri, match) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(Pass), 10);
      });
    },
  });

  assert({
    given: 'a JSON chip with async chips',
    should: 'have a false ready state',
    actual: chip.fromJSON(chipJSON).isReady,
    expected: false,
  });

  assert({
    given: 'a JSON chip with async chips',
    should: 'wait for it to be ready',
    actual: await chip.fromJSON(chipJSON).ready,
    expected: true,
  });

  assert({
    given: 'a JSON chip with async chips',
    should: 'compile and run after being ready',
    actual: await (async () => {
      const C = chip.fromJSON(chipJSON);
      await C.ready;
      return compileAndRun(C, (chip) => {
        const res = [];
        chip.out.then(() => {
          res.push(chip.out.output());
        });
        chip.in.exec();
        chip.in.input = 7;
        chip.in.exec();
        chip.out.handle()(9);
        return res;
      });
    }),
    expected: compileAndRunResult(js``, [3, 7, 9]),
  });
});
