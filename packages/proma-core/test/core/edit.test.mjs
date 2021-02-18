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
  const input = inputData('input');
  const then = outputFlow('then');
  const output = outputData('output', then);
  wire(exec, then);
  wire(input, output);
});

describe('[core/edit] adding stuff to chip', async (assert) => {
  const passFlow = (chip) => {
    let res;
    chip.out.then(() => {
      res = 'ok';
    });
    chip.in.exec();
    return res;
  };

  assert({
    given: 'an added in/out flow with connection',
    should: 'edit',
    actual: editCompileAndRun(
      (edit) =>
        edit
          .addInputFlowPort('exec')
          .addOutputFlowPort('then')
          .addConnection('exec', 'then'),
      passFlow,
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

  assert({
    given: 'an added sub-chip instance and connections',
    should: 'add the sub-chip and accept $N chip refs',
    actual: editCompileAndRun(
      (edit) =>
        edit
          .addInputFlowPort('exec')
          .addOutputFlowPort('then')
          .addChip(new Pass())
          .addConnection('exec', '$0.in.exec')
          .addConnection('$0.out.then', 'then'),
      passFlow,
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
