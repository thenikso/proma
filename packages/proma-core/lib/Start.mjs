import { chip, outputFlow } from '../core/index.mjs';

export default chip('Start', () => {
  const then = outputFlow('then', () => then());
});
