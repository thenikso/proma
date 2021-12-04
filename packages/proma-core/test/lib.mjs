import {
  chip,
  inputFlow,
  inputData,
  inputConfig,
  outputFlow,
  outputData,
  wire,
} from '../core/index.mjs';

export const Log = chip('Log', () => {
  const exec = inputFlow('exec', () => {
    console.log(message());
    then();
  });
  const message = inputData('message', { canonical: true });
  const then = outputFlow('then');
});

export const Literal = chip('Literal', () => {
  const value = inputConfig('value');
  outputData('value', () => value());
});

export const Split = chip('Split', () => {
  const exec = inputFlow('exec', () => {
    then1();
    then2();
  });
  const then1 = outputFlow('then1');
  const then2 = outputFlow('then2');
});

export const Pass = chip('Pass', () => {
  const exec = inputFlow('exec');
  const input = inputData('input', { canonical: true });
  const then = outputFlow('then');
  const output = outputData('output', then);
  wire(exec, then);
  wire(input, output);
});
