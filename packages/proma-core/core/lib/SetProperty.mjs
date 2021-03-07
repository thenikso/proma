export default function install({
  registry,
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
}) {
  return registry.add(
    chip('lib/SetProperty', () => {
      const exec = inputFlow('exec', () => {
        target()[property()] = value();
        then();
      });
      const target = inputData('target', { type: 'Object', canonical: true });
      const property = inputData('property', {
        type: 'String',
        canonical: true,
      });
      const value = inputData('value');

      const then = outputFlow('then');
    }),
  );
}
