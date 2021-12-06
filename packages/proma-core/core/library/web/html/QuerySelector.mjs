export default function install({
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
}) {
  return chip('html/QuerySelector', () => {
    const target = inputData('target', { canonical: true, type: 'Element' });
    const selector = inputData('selector', {
      canonical: true,
      type: 'String',
    });

    const element = outputData('element', {
      type: 'Element',
      compute: () => target().querySelector(selector()),
    });
  });
}
