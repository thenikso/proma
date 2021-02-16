import { chip, inputConfig, outputData } from '../core/index.mjs';

export default chip('Literal', () => {
  const value = inputConfig('value');
  outputData('value', () => value());
});
