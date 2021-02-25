export default function install({ chip, inputFlow, inputData, outputFlow }) {
  return chip('lib/debug/Log', () => {
    const exec = inputFlow('exec', () => {
      console.log(message());
      then();
    });
    const message = inputData('message', { canonical: true, type: 'String' });
    const then = outputFlow('then');
  });
}
