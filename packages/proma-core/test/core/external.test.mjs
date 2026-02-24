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
  const EXTERNAL_TEST_FUNC = () => 'test-func-result';
  assert({
    given: 'external reference canonical input',
    should: 'compile referencing the canonical input',
    actual: compileAndRun(
      () => {
        const func = inputData('func', {
          canonical: 'required',
          concealed: 'hidden',
        });
        const exec = inputFlow('exec');

        const then = outputFlow('then');
        const output = outputData('output', () => func()());

        wire(exec, then);
      },
      (chip) => {
        const res = [];
        chip.out.then(() => {
          res.push(chip.out.output());
        });
        chip.in.exec();
        return res;
      },
      [externalRef({ EXTERNAL_TEST_FUNC })],
    ),
    expected: compileAndRunResult(
      js`
      class TestChip {
        constructor(func = EXTERNAL_TEST_FUNC) {
          const $in = Object.seal({
            func
          });

          const $out = Object.seal({
            then: undefined
          });

          Object.defineProperties(this.in = {}, {
            func: {
              get: () => () => $in.func
            },

            exec: {
              value: () => {
                this.out.then();
              }
            }
          });

          Object.freeze(this.in);

          Object.defineProperties(this.out = {}, {
            output: {
              enumerable: true,
              value: () => $in.func()
            },

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

          Object.defineProperty(this, "destroy", {
            value: () => {}
          });
        }
      }`,
      ['test-func-result'],
    ),
  });

  const GetData = plainChip('test/programs/external/GetData', () => {
    const getData = inputData('getData', {
      canonical: 'required',
      concealed: 'hidden',
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
      concealed: 'hidden',
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
        setData.id = 'SetExternalData';
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

          let SetExternalData__value;

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
                  SetExternalData__value = $in.input;
                  console.log(SetExternalData__value);
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
