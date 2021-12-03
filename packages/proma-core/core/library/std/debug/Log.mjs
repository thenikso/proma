export default function install({ chip, inputFlow, inputData, outputFlow }) {
  return chip('debug/Log', () => {
    const exec = inputFlow('exec', () => {
      console.log(message());
      then();
    });
    const message = inputData('message', { canonical: true });
    const then = outputFlow('then');
  });
}
