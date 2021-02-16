import {
  chip,
  inputData,
  outputData,
} from '../core/index.mjs';

export default chip(() => {
  // TODO variadic, this will make the chip use a Proxy
  const A = inputData('A');
  const B = inputData('B');
  // TODO we should forbid using anything that's not an input data
  outputData('value', () => A() + B());
});
