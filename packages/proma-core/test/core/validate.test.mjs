import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
  validate,
} from '../../core/index.mjs';
import { Pass, Log, Literal } from '../lib.mjs';

//
// Helper: build a fully wired valid chip using Pass as a sub-chip
//
const ValidChip = chip('test/validate/ValidChip', () => {
  const exec = inputFlow('exec');
  const input = inputData('input', { canonical: true });
  const then = outputFlow('then');
  const output = outputData('output');

  const pass = new Pass();
  pass.id = 'pass';

  wire(exec, pass.in.exec);
  wire(input, pass.in.input);
  wire(pass.out.then, then);
  wire(pass.out.output, output);
});

describe('[core/validate] valid chip', async (assert) => {
  assert({
    given: 'a fully connected chip',
    should: 'return no diagnostics',
    actual: validate(ValidChip),
    expected: [],
  });

  assert({
    given: 'a chip instance',
    should: 'return no diagnostics',
    actual: validate(new ValidChip('hello')),
    expected: [],
  });

  assert({
    given: 'a null argument',
    should: 'return an invalid-chip error',
    actual: validate(null).map((d) => d.code),
    expected: ['invalid-chip'],
  });
});

describe('[core/validate] disconnected-input', async (assert) => {
  const ChipWithDisconnected = chip(
    'test/validate/ChipWithDisconnected',
    () => {
      const exec = inputFlow('exec');
      const then = outputFlow('then');
      const pass = new Pass();
      pass.id = 'pass';
      // Wire exec and flow, but NOT the data port pass.in.input
      wire(exec, pass.in.exec);
      wire(pass.out.then, then);
    },
  );

  assert({
    given: 'a sub-chip input data port with no connection, value, or default',
    should: 'produce a disconnected-input warning',
    actual: validate(ChipWithDisconnected).map((d) => ({
      level: d.level,
      code: d.code,
    })),
    expected: [{ level: 'warning', code: 'disconnected-input' }],
  });

  assert({
    given: 'a sub-chip input data port with an explicit value set',
    should: 'produce no disconnected-input warning',
    actual: (() => {
      const ChipWithExplicit = chip('test/validate/ChipWithExplicit', () => {
        const exec = inputFlow('exec');
        const then = outputFlow('then');
        const pass = new Pass();
        pass.id = 'pass';
        pass.in.input = 'explicit-value';
        wire(exec, pass.in.exec);
        wire(pass.out.then, then);
        wire(pass.out.output, outputData('output'));
      });
      return validate(ChipWithExplicit).filter(
        (d) => d.code === 'disconnected-input',
      );
    })(),
    expected: [],
  });
});

describe('[core/validate] unreachable-chip', async (assert) => {
  const ChipWithUnreachable = chip('test/validate/ChipWithUnreachable', () => {
    const exec = inputFlow('exec');
    const then = outputFlow('then');
    // This log chip has no connections at all
    const log = new Log('hello');
    log.id = 'log';
    wire(exec, then);
  });

  assert({
    given: 'a sub-chip with no connections',
    should: 'produce an unreachable-chip warning',
    actual: validate(ChipWithUnreachable)
      .filter((d) => d.code === 'unreachable-chip')
      .map((d) => ({ level: d.level, code: d.code, path: d.path })),
    expected: [{ level: 'warning', code: 'unreachable-chip', path: 'log' }],
  });

  assert({
    given: 'all sub-chips connected',
    should: 'produce no unreachable-chip warning',
    actual: validate(ValidChip).filter((d) => d.code === 'unreachable-chip'),
    expected: [],
  });
});

describe('[core/validate] dangling-flow', async (assert) => {
  const ChipWithDanglingFlow = chip(
    'test/validate/ChipWithDanglingFlow',
    () => {
      const exec = inputFlow('exec');
      const log = new Log('hello');
      log.id = 'log';
      wire(exec, log.in.exec);
      // log.out.then is not connected anywhere — dangling
    },
  );

  assert({
    given: 'a sub-chip output flow port not connected',
    should: 'produce a dangling-flow warning',
    actual: validate(ChipWithDanglingFlow)
      .filter((d) => d.code === 'dangling-flow')
      .map((d) => ({ level: d.level, code: d.code })),
    expected: [{ level: 'warning', code: 'dangling-flow' }],
  });

  assert({
    given: 'all flow ports connected',
    should: 'produce no dangling-flow warning',
    actual: validate(ValidChip).filter((d) => d.code === 'dangling-flow'),
    expected: [],
  });
});

describe('[core/validate] no-entry-flow', async (assert) => {
  const ChipWithNoEntry = chip('test/validate/ChipWithNoEntry', () => {
    const exec = inputFlow('exec');
    const then = outputFlow('then');
    const log = new Log('hello');
    log.id = 'log';
    // exec outlet is NOT connected to any sub-chip
    wire(log.out.then, then);
  });

  assert({
    given: 'a chip with input flow outlet not connected to any sub-chip',
    should: 'produce a no-entry-flow warning',
    actual: validate(ChipWithNoEntry)
      .filter((d) => d.code === 'no-entry-flow')
      .map((d) => ({ level: d.level, code: d.code })),
    expected: [{ level: 'warning', code: 'no-entry-flow' }],
  });

  assert({
    given: 'a chip with input flow outlet connected',
    should: 'produce no no-entry-flow warning',
    actual: validate(ValidChip).filter((d) => d.code === 'no-entry-flow'),
    expected: [],
  });
});

describe('[core/validate] data-cycle', async (assert) => {
  const ChipWithDataCycle = chip('test/validate/ChipWithDataCycle', () => {
    const exec = inputFlow('exec');
    const then = outputFlow('then');

    const passA = new Pass();
    passA.id = 'passA';
    const passB = new Pass();
    passB.id = 'passB';

    wire(exec, passA.in.exec);
    wire(passA.out.then, passB.in.exec);
    wire(passB.out.then, then);

    // Data cycle: passA.out.output -> passB.in.input -> passB.out.output -> passA.in.input
    wire(passA.out.output, passB.in.input);
    wire(passB.out.output, passA.in.input);
  });

  assert({
    given: 'a chip with a data cycle between sub-chips',
    should: 'produce a data-cycle error',
    actual: validate(ChipWithDataCycle)
      .filter((d) => d.code === 'data-cycle')
      .map((d) => ({ level: d.level, code: d.code })),
    expected: [{ level: 'error', code: 'data-cycle' }],
  });

  assert({
    given: 'a chip with no data cycles',
    should: 'produce no data-cycle error',
    actual: validate(ValidChip).filter((d) => d.code === 'data-cycle'),
    expected: [],
  });
});
