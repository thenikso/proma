export default function install({ registry, chip, inputData, outputData }) {
  return registry.add(
    chip('lib/string/Append', () => {
      const input = inputData('input', {
        variadic: '{letter}',
        type: 'String',
        canonical: true,
      });

      const value = outputData('value', {
        compute: () => input().join(''),
      });
    }),
  );
}
