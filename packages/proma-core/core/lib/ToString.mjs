export default function install({ registry, chip, inputData, outputData }) {
  return registry.add(
    chip('lib/ToString', () => {
      const target = inputData('target', { canonical: true });
      const string = outputData('string', {
        compute: () => String(target()),
        type: 'string',
      });
    }),
  );
}
