export default function install({
  registry,
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
}) {
  return registry.add(
    chip('lib/GetProperty', () => {
      const exec = inputFlow('exec', () => {
        value(target()[property()]);
        then();
      });
      const target = inputData('target', { type: 'Object', canonical: true });
      const property = inputData('property', {
        type: 'String',
        canonical: true,
      });

      const then = outputFlow('then');
      const value = outputData('value');
    }),
  );
}
