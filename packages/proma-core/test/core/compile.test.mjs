import { describe } from '../runner/riteway.mjs';
import {
  chip,
  fromJSON,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';
import { js } from '../utils.mjs';
import { Log } from '../lib.mjs';

describe('[core/compile] compilation regression checks', async (assert) => {
  const TestChip = fromJSON(chip, {
    URI: 'Main',
    in: [
      {
        name: 'target',
        kind: 'data',
        canonical: true,
      },
    ],
    chips: [
      {
        id: 'OnCreate_1',
        chipURI: 'OnCreate:event',
      },
      {
        id: 'lib_debug_Log_1',
        chipURI: 'lib/debug/Log',
      },
      {
        id: 'lib_html_QuerySelector_1',
        chipURI: 'lib/html/QuerySelector',
        args: [null, 'button'],
      },
      {
        id: 'lib_html_BindEvent_1',
        chipURI: 'lib/html/BindEvent',
        args: [null, 'click'],
      },
      {
        id: 'OnDestroy_1',
        chipURI: 'OnDestroy:event',
      },
      {
        id: 'CustomEvent_1',
        chipURI: 'CustomEvent:event(event:Event)',
      },
    ],
    connections: [
      {
        source: 'lib_html_QuerySelector_1.in.exec',
        sink: 'OnCreate_1.out.then',
      },
      {
        source: 'in.target',
        sink: 'lib_html_QuerySelector_1.in.target',
      },
      {
        source: 'lib_html_QuerySelector_1.out.element',
        sink: 'lib_html_BindEvent_1.in.target',
      },
      {
        source: 'lib_html_BindEvent_1.in.bind',
        sink: 'lib_html_QuerySelector_1.out.then',
      },
      {
        source: 'lib_html_BindEvent_1.in.unbind',
        sink: 'OnDestroy_1.out.then',
      },
      {
        source: 'CustomEvent_1.out.handle',
        sink: 'lib_html_BindEvent_1.in.event',
      },
      {
        source: 'lib_debug_Log_1.in.exec',
        sink: 'CustomEvent_1.out.then',
      },
      {
        source: 'CustomEvent_1.out.event',
        sink: 'lib_debug_Log_1.in.message',
      },
    ],
  });

  assert({
    given: 'the same compilation twice',
    should: 'be identical',
    actual: TestChip.compile(),
    expected: TestChip.compile(),
  });

  const AsyncEcho = chip('test/core/compile/AsyncEcho', () => {
    const exec = inputFlow('exec', async () => {
      try {
        const data = await Promise.resolve(input());
        output(data);
        error(null);
      } catch (e) {
        output(null);
        error(e);
      }
      then();
    });
    const input = inputData('input', { canonical: true });

    const then = outputFlow('then');
    const output = outputData('output');
    const error = outputData('error');
  });

  const Endpoint = chip('test/core/compile/Endpoint', () => {
    const exec = inputFlow('exec');
    const echo = new AsyncEcho('test');
    const then = outputFlow('then');
    const res = outputData('res');

    wire(exec, echo.in.exec);
    wire(echo.out.output, res);
    wire(echo.out.then, then);
  });

  assert({
    given: 'compiling and enpoint (regression found in testing)',
    should: 'compile',
    actual: Endpoint.compile(),
    expected: js`
    class test_core_compile_Endpoint {
      constructor() {
        const $out = Object.seal({
          res: undefined,
          then: undefined
        });

        Object.defineProperties(this.in = {}, {
          exec: {
            value: () => {
              (async () => {
                try {
                  const data = await Promise.resolve("test");
                  $out.res = data;
                } catch (e) {
                  $out.res = null;
                }

                this.out.then();
              })();
            }
          }
        });

        Object.freeze(this.in);

        Object.defineProperties(this.out = {}, {
          res: {
            value: () => $out.res
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
  });
});
