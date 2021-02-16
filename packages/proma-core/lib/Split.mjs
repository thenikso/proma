import { chip, inputFlow, outputFlow } from '../core/index.mjs';

// TODO make variadic split
export default chip('Split', () => {
  const exec = inputFlow('exec', () => {
    then1();
    then2();
  });
  const then1 = outputFlow('then1');
  const then2 = outputFlow('then2');
});
