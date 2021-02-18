import { describe } from '../runner/riteway.mjs';
import { chip } from '../../core/index.mjs';
import { js, editCompileAndRun, compileAndRunResult } from '../utils.mjs';

describe('[core/edit] adding stuff to chip', async (assert) => {
  assert({
    given: 'an added in/out flow with connection',
    should: 'edit the chip',
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

          Object.seal(this.out);
        }
      }`,
      'ok',
    ),
  });
});
