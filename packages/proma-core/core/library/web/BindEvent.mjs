export default function install({ chip, inputFlow, inputData, outputFlow }) {
  return chip('BindEvent', () => {
    const bindF = () => {
      target().addEventListener(type(), event());
      then();
    };
    bindF.toString = () => `() => {
        target().addEventListener(type(), event());
        then();
      }`;
    const bind = inputFlow('bind', bindF);
    const unbindF = () => {
      target().removeEventListener(type(), event());
      then();
    };
    unbindF.toString = () => `() => {
        target().removeEventListener(type(), event());
        then();
      }`;
    const unbind = inputFlow('unbind', unbindF);

    const target = inputData('target', { canonical: true, type: 'Element' });
    const type = inputData('type', { canonical: true, type: 'String' });
    const event = inputData('event', { type: '(event:Event) => void' });

    const then = outputFlow('then');
  });
}
