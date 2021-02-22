export default function install({ chip, inputConfig, outputData }) {
  return chip('lib/Literal', () => {
    const value = inputConfig('value');
    outputData('value', () => value());
  });
}
