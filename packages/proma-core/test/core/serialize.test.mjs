import { describe } from '../runner/riteway.mjs';
import {
  Chip,
  chip,
  event,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
  inputConfig,
  outputHandle,
  registry,
  fromJSON,
} from '../../core/index.mjs';
import { info } from '../../core/utils.mjs';
import { js, compileAndRun, compileAndRunResult } from '../utils.mjs';

const Pass = chip('Pass', () => {
  const exec = inputFlow('exec');
  const input = inputData('input', { canonical: true });
  const then = outputFlow('then');
  const output = outputData('output', then);
  wire(exec, then);
  wire(input, output);
});

const chipJSON = {
  URI: 'TestChipSerialize',
  in: [
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
  out: [
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
      chipURI: 'test/serialize#Pass',
      args: ['pass-input'],
    },
  ],
  connections: [
    {
      source: 'in.exec',
      sink: 'Pass.in.exec',
    },
    {
      source: 'Pass.out.then',
      sink: 'out.then',
    },
    {
      source: 'in.input',
      sink: 'Pass.in.input',
    },
    {
      source: 'Pass.out.output',
      sink: 'out.output',
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

      let Pass__output;

      const $__handle = o => {
        $out.output = o;
        this.out.then();
      };

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

const testRegistry = registry.copy.add(Pass, 'test/serialize');

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
    }).toJSON(testRegistry),
    expected: chipJSON,
  });

  const TestEvent = event(
    'TestEvent',
    { name: 'event', type: 'Event' },
    'num:Number',
  );

  assert({
    given: 'an event sub-chip',
    should: 'serialize with its port definition',
    actual: chip('TestChipEventSerialize', () => {
      const evt = new TestEvent();
    }).toJSON(),
    expected: {
      URI: 'TestChipEventSerialize',
      chips: [
        {
          id: 'TestEvent_1',
          chipURI: 'TestEvent:event(event:Event, num:Number)',
        },
      ],
    },
  });
});

describe('[core/serialize] from JSON', async (assert) => {
  const opts = { registry: testRegistry };

  assert({
    given: 'a chip in JSON format',
    should: 'deserialize to a Chip class',
    actual: fromJSON(chip, chipJSON, opts).__proto__,
    expected: Chip,
  });

  assert({
    given: 'a chip from JSON',
    should: 'have a loaded state',
    actual: fromJSON(chip, chipJSON, opts).isLoaded,
    expected: true,
  });

  assert({
    given: 'a chip from JSON',
    should: 'wait for it to be loaded',
    actual: await fromJSON(chip, chipJSON, opts).loaded,
    expected: true,
  });

  assert({
    given: 'a chip from JSON',
    should: 'compile and run',
    actual: compileAndRun(fromJSON(chip, chipJSON, opts), (chip) => {
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

  assert({
    given: 'an event sub-chip',
    should: 'properly deserializes',
    actual: (() => {
      const EventChip = fromJSON(chip, {
        URI: 'TestChipEventSerialize',
        chips: [
          {
            id: 'TestEvent',
            chipURI: 'TestEvent:event(event:Event, num:Number)',
          },
        ],
      });
      const chipInfo = info(EventChip);
      const subChipInfo = info(chipInfo.chips[0]);
      return subChipInfo.outputs.map((o) => o.name);
    })(),
    expected: ['handle', 'then', 'event', 'num'],
  });
});

describe('[core/serialize] from JSON with async chips', async (assert) => {
  const asyncChipJSON = {
    ...chipJSON,
    chips: [
      {
        id: 'Pass',
        chipURI: 'test/serialize#Pass',
      },
    ],
  };

  let passAsyncResolver;
  const testAsyncRegistry = registry.copy.resolver(
    /^test\/serialize(?:#(Pass))?$/,
    (add, match) => {
      // NOTE async resolvers should avoid trying to add the same chip twice
      // and cache the resolving promise.
      if (!passAsyncResolver) {
        passAsyncResolver = new Promise((resolve) => {
          setTimeout(() => {
            resolve();
          }, 10);
        });
      }
      // Given that registries are always copied by `edit`, a resolver
      // should cache the resolved chips and add them on ucoming requests.
      // FIX This might have problems if there are multiple resolution requests
      // for the same registry/chip while still resolving the original promise.
      return passAsyncResolver.then(() => {
        add(Pass, 'test/serialize');
      });
    },
  );

  const opt = { registry: testAsyncRegistry };

  assert({
    given: 'a JSON chip with async chips',
    should: 'have a false loaded state',
    actual: fromJSON(chip, asyncChipJSON, opt).isLoaded,
    expected: false,
  });

  assert({
    given: 'a JSON chip with async chips',
    should: 'wait for it to be loaded',
    actual: await fromJSON(chip, asyncChipJSON, opt).loaded,
    expected: true,
  });

  assert({
    given: 'a JSON chip with async chips',
    should: 'compile and run after being loaded',
    actual: await (async () => {
      const C = fromJSON(chip, asyncChipJSON, opt);
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

describe('[core/serialize] from JSON with `use` property', async (assert) => {
  // TODO add tests for `use` that uses short UIDs in chip names
});
