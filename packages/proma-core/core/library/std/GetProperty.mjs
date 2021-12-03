export default function install({ chip, inputData, outputData }) {
  return chip('GetProperty', () => {
    const target = inputData('target', { type: 'Object', canonical: true });
    const property = inputData('property', {
      type: 'String',
      canonical: true,
    });

    const compute = () => target()[property()];
    compute.toString = () => '() => target()[property()]';
    outputData('value', compute);
  });
}
