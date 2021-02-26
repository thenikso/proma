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

describe('[core/external] get/set external data', async (assert) => {
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
