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
  registry,
} from '../../core/index.mjs';
import { js, compileAndRun, compileAndRunResult } from '../utils.mjs';

const Pass = registry.add(
  chip('test/serialize/Pass', () => {
    const exec = inputFlow('exec');
    const input = inputData('input', { canonical: true });
    const then = outputFlow('then');
    const output = outputData('output', then);
    wire(exec, then);
    wire(input, output);
  }),
);

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
      allowSideEffects: true,
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
      source: 'exec',
      sink: 'Pass.in.exec',
    },
    {
      source: 'Pass.out.then',
      sink: 'then',
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

const chipJS = js`
  class TestChipSerialize {
    constructor(input, conf) {
      const $in = Object.seal({
        input: input || 3,
        conf: conf || true
      });

      const $out = Object.seal({
        output: undefined,
        then: undefined
      });

      const $__handle = o => {
        $out.output = o;
        this.out.then();
      };

      let Pass__output;

      Object.defineProperties(this.in = {}, {
        input: {
          get: () => () => $in.input,

          set: value => {
            $in.input = value;
          }
        },

        conf: {
          get: () => () => $in.conf,

          set: value => {
            $in.conf = value;
          }
        },

        exec: {
          value: () => {
            Pass__output = $in.input;
            this.out.then();
          }
        }
      });

      Object.freeze(this.in);

      Object.defineProperties(this.out = {}, {
        output: {
          value: () => $out.output
        },

        handle: {
          enumerable: true,
          value: () => $__handle
        },

        then: {
          value: value => {
            if (typeof value !== "undefined") {
              $out.then = value;
              return;
            }

            $out.output = Pass__output;
            ($out.then || (() => {}))();
          }
        }
      });

      Object.freeze(this.out);

      Object.defineProperty(this, "destroy", {
        value: () => {}
      });
    }
  }`;

describe('[core/serialize] to JSON', async (assert) => {
  assert({
    given: 'a chip',
    should: 'serialize to JSON',
    actual: chip('TestChipSerialize', () => {
      const exec = inputFlow('exec');
      const input = inputData('input', { canonical: true, defaultValue: 3 });
      const conf = inputConfig('conf', { defaultValue: true });

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
    should: 'have a loaded state',
    actual: chip.fromJSON(chipJSON).isLoaded,
    expected: true,
  });

  assert({
    given: 'a chip from JSON',
    should: 'wait for it to be loaded',
    actual: await chip.fromJSON(chipJSON).loaded,
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
    expected: compileAndRunResult(chipJS, [3, 7, 7]),
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

  promaRegistry.loader({
    test: /^test\/serialize\/(PassAsync)$/,
    load(chipUri, match) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(Pass), 10);
      });
    },
  });

  assert({
    given: 'a JSON chip with async chips',
    should: 'have a false loaded state',
    actual: chip.fromJSON(asyncChipJSON).isLoaded,
    expected: false,
  });

  assert({
    given: 'a JSON chip with async chips',
    should: 'wait for it to be loaded',
    actual: await chip.fromJSON(asyncChipJSON).loaded,
    expected: true,
  });

  assert({
    given: 'a JSON chip with async chips',
    should: 'compile and run after being loaded',
    actual: await (async () => {
      const C = chip.fromJSON(asyncChipJSON);
      await C.loaded;
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
    })(),
    expected: compileAndRunResult(chipJS, [3, 7, 7]),
  });
});
