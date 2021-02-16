import { chip, inputFlow, inputData, outputFlow } from '../core/index.mjs';

export default chip('Log', () => {
  const exec = inputFlow('exec', () => {
    console.log(message());
    then();
  });
  const message = inputData('message', { canonical: true });
  const then = outputFlow('then');
});
