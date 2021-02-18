import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';
import { js, editCompileAndRun, compileAndRunResult } from '../utils.mjs';

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
    actual: editCompileAndRun(
      (edit) =>
        edit
          .addInputFlowPort('exec')
          .addOutputFlowPort('then')
          .addConnection('exec', 'then'),
      (chip) => {
        let res;
        chip.out.then(() => {
          res = 'ok';
        });
        chip.in.exec();
        return res;
      },
    ),
    expected: compileAndRunResult(
      js`
      class EditChip {
        constructor() {
          const $out = Object.seal({
            then: undefined
          });

          Object.defineProperties(this.in = {}, {
            exec: {
              value: () => {
                this.out.then();
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            then: {
              value: value => {
                if (typeof value !== "undefined") {
                  $out.then = value;
                  return;
                }

                ($out.then || (() => {}))();
              }
            }
          });

          Object.freeze(this.out);
        }
      }`,
      'ok',
    ),
  });
});

describe('[core/edit] add sub-chips', async (assert) => {
  const passFlow = (chip) => {
    let res;
    chip.out.then(() => {
      res = 'ok';
    });
    chip.in.exec();
    return [res, chip.out.value()];
  };

  const expectedCode = js`
    class EditChip {
      constructor() {
        const $out = Object.seal({
          value: undefined,
          then: undefined
        });

        let Pass__output;

        Object.defineProperties(this.in = {}, {
          exec: {
            value: () => {
              Pass__output = "pass";
              this.out.then();
            }
          }
        });

        Object.freeze(this.in);

        Object.defineProperties(this.out = {}, {
          value: {
            value: () => $out.value
          },

          then: {
            value: value => {
              if (typeof value !== "undefined") {
                $out.then = value;
                return;
              }

              $out.value = Pass__output;
              ($out.then || (() => {}))();
            }
          }
        });

        Object.freeze(this.out);
      }
    }`;

  assert({
    given: 'a chip instance',
    should: 'add the sub-chip',
    actual: editCompileAndRun(
      (edit) =>
        edit
          .addInputFlowPort('exec')
          .addOutputFlowPort('then')
          .addOutputDataPort('value')
          .addChip('Pass', new Pass('pass'))
          .addConnection('exec', '$0.in.exec')
          .addConnection('$0.out.output', 'value')
          .addConnection('$0.out.then', 'then'),
      passFlow,
    ),
    expected: compileAndRunResult(expectedCode, ['ok', 'pass']),
  });

  assert({
    given: 'a chip class',
    should: 'add the sub-chip',
    actual: editCompileAndRun(
      (edit) =>
        edit
          .addInputFlowPort('exec')
          .addOutputFlowPort('then')
          .addOutputDataPort('value')
          .addChip('Pass', Pass, ['pass'])
          .addConnection('exec', 'Pass.in.exec')
          .addConnection('Pass.out.output', 'value')
          .addConnection('Pass.out.then', 'then'),
      passFlow,
    ),
    expected: compileAndRunResult(expectedCode, ['ok', 'pass']),
  });
});
