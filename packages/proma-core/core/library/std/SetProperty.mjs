export default function install({
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
}) {
  return chip('SetProperty', () => {
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
  });
}
