export default function install({ chip, inputData, outputData }) {
  return chip('ToString', () => {
    const target = inputData('target', { canonical: true });
    const string = outputData('string', {
      compute: () => String(target()),
      type: 'string',
    });
  });
}
