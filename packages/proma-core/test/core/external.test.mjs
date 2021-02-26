import { describe } from '../runner/riteway.mjs';
import {
  plainChip,
  inputConfig,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
  externalRef,
} from '../../core/index.mjs';
import { js, compileAndRun, compileAndRunResult } from '../utils.mjs';
import { Log } from '../lib.mjs';

describe('[core/external] get external data', async (assert) => {
  const GetData = plainChip('test/programs/external/GetData', () => {
    const getData = inputData('getData', {
      canonical: 'required',
      conceiled: 'hidden',
    });
    outputData('value', () => getData());
  });

  const EXTERNAL_TEST_DATA = { data: 'external-test-data' };

  class GetTestData extends GetData {
    constructor() {
      super(externalRef({ EXTERNAL_TEST_DATA }));
    }
  }

  assert({
    given: 'an external data accessor',
    should: 'compile with an external reference',
    actual: compileAndRun(
      ({ OnCreate }) => {
        const externalData = new GetTestData();

        const onCreate = new OnCreate();
        const log = new Log();

        wire(onCreate.out.then, log.in.exec);
        wire(externalData.out.value, log.in.message);
      },
      null,
      null,
      { EXTERNAL_TEST_DATA },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor() {
          {
            console.log(EXTERNAL_TEST_DATA);
          }

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      [EXTERNAL_TEST_DATA],
    ),
  });
});

describe('[core/external] set external data', async (assert) => {
  const SetData = plainChip('test/programs/external/SetData', () => {
    const exec = inputFlow('exec', () => {
      setFunctionRef()(value());
      then();
    });
    const setFunctionRef = inputData('setFunctionRef', {
      canonical: 'required',
      conceiled: 'hidden',
    });
    const value = inputData('value', {
      canonical: true,
    });
    const then = outputFlow('then');
    const outValue = outputData('value');
    wire(value, outValue);
  });

  const EXTERNAL_TEST_DATA = { data: 'OLD' };

  const SET_EXTERNAL_TEST_DATA = (val) => (EXTERNAL_TEST_DATA.data = val);

  class SetTestData extends SetData {
    constructor(...args) {
      super(externalRef({ SET_EXTERNAL_TEST_DATA }), ...args);
    }
  }

  assert({
    given: 'an external data setter',
    should: 'compile with an external reference',
    actual: compileAndRun(
      () => {
        const exec = inputFlow('exec');
        const input = inputData('input', true);

        const setData = new SetTestData();
        const log = new Log();

        wire(exec, setData.in.exec);
        wire(input, setData.in.value);
        wire(setData.out.then, log.in.exec);
        wire(setData.out.value, log.in.message);
      },
      (chip, logs) => {
        EXTERNAL_TEST_DATA.data = 'OLD';
        chip.in.exec();
        return {
          ...EXTERNAL_TEST_DATA,
          logs,
        };
      },
      ['NEW'],
      { SET_EXTERNAL_TEST_DATA },
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor(input = "NEW") {
          const $in = Object.seal({
            input
          });

          let test_programs_external_SetData_1__value;

          Object.defineProperties(this.in = {}, {
            input: {
              get: () => () => $in.input,

              set: value => {
                $in.input = value;
              }
            },

            exec: {
              value: () => {
                SET_EXTERNAL_TEST_DATA($in.input);

                {
                  test_programs_external_SetData_1__value = $in.input;
                  console.log(test_programs_external_SetData_1__value);
                };
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      { data: 'NEW', logs: ['NEW'] },
    ),
  });
});
