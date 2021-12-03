export default function install({ chip, inputData, outputData }) {
  return chip('string/Append', () => {
    const input = inputData('input', {
      variadic: '{letter}',
      type: 'String',
      canonical: true,
    });

    const value = outputData('value', {
      compute: () => input().join(''),
      type: 'String',
    });
  });
}
