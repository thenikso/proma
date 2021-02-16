import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
} from '../../core/index.mjs';
import { Start, Split, Log } from '../../lib/index.mjs';

import { findChildEmitters } from '../../core/compile.mjs';

describe('[core/compile] findChildEmitters', async (assert) => {
  const toLiteral = (g) => ({
    chipPathLenght: g.scope.length,
    port: g.port.name,
  });

  assert({
    given: 'A chip with a generator',
    should: 'find the generator',
    actual: findChildEmitters(
      chip(() => {
        const start = Start();
        const log = Log();
        log.in.message = 'hello world';
        wire(start.out.then, log.in.exec);
      })(),
    ).map(toLiteral),
    expected: [{ chipPathLenght: 2, port: 'then' }],
  });

  assert({
    given: 'A chip with a nested generator directly connected',
    should: 'find the generator',
    actual: findChildEmitters(
      chip(() => {
        const start = chip(() => {
          const start = Start();
          const then = outputFlow('then');
          wire(start.out.then, then);
        })();
        const log = Log();
        log.in.message = 'hello world';
        wire(start.out.then, log.in.exec);
      })(),
    ).map(toLiteral),
    expected: [{ chipPathLenght: 3, port: 'then' }],
  });

  assert({
    given: 'A chip with a nested generator masked by a split',
    should: 'find the generator',
    actual: findChildEmitters(
      chip(() => {
        const start = chip(() => {
          const start = Start();
          const split = Split();
          const then = outputFlow('then');
          wire(start.out.then, split.in.exec);
          wire(split.out.then2, then);
        })();
        const log = Log();
        log.in.message = 'hello world';
        wire(start.out.then, log.in.exec);
      })(),
    ).map(toLiteral),
    expected: [{ chipPathLenght: 3, port: 'then' }],
  });
});
