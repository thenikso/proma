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
      const exec = inputFlow('exec', () => {
        element(target().querySelector(selector()));
        then();
      });
      const target = inputData('target', { canonical: true, type: 'Element' });
      const selector = inputData('selector', {
        canonical: true,
        type: 'String',
      });

      const then = outputFlow('then');
      const element = outputData('element', 'Element');
    }),
  );
}
