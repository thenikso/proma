export default function install({
  registry,
  chip,
  inputFlow,
  inputData,
  outputFlow,
}) {
  return registry.add(
    chip('lib/html/BindEvent', () => {
      const bind = inputFlow('bind', () => {
        target().addEventListener(type(), event());
        then();
      });
      const unbind = inputFlow('unbind', () => {
        target().removeEventListener(type(), event());
        then();
      });
      const target = inputData('target', { canonical: true, type: 'Element' });
      const type = inputData('type', { canonical: true, type: 'String' });
      const event = inputData('event', { type: '(event:Event) => void' });

      const then = outputFlow('then');
    }),
  );
}
