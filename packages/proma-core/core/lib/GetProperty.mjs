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
      const target = inputData('target', { type: 'Object', canonical: true });
      const property = inputData('property', {
        type: 'String',
        canonical: true,
      });

      const value = outputData('value', () => target()[property()]);
    }),
  );
}
