export default function install({
  registry,
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
}) {
  return registry.add(
    chip('lib/html/QuerySelector', () => {
      const target = inputData('target', { canonical: true, type: 'Element' });
      const selector = inputData('selector', {
        canonical: true,
        type: 'String',
      });

      const element = outputData('element', {
        type: 'Element',
        compute: () => target().querySelector(selector()),
      });
    }),
  );
}
