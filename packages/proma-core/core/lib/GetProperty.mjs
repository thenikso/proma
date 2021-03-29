export default function install({ registry, chip, inputData, outputData }) {
  return registry.add(
    chip('lib/GetProperty', () => {
      const target = inputData('target', { type: 'Object', canonical: true });
      const property = inputData('property', {
        type: 'String',
        canonical: true,
      });

      const compute = () => target()[property()];
      compute.toString = () => '() => target()[property()]';
      const value = outputData('value', compute);
    }),
  );
}
