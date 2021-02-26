export default function install({ registry, chip, inputFlow, inputData, outputFlow }) {
  return registry.add(
    chip('lib/debug/Log', () => {
      const exec = inputFlow('exec', () => {
        console.log(message());
        then();
      });
      const message = inputData('message', { canonical: true, type: 'String' });
      const then = outputFlow('then');
    }),
  );
}
