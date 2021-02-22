export default function install({ chip, inputConfig, outputData }) {
  return chip('Literal', () => {
    const value = inputConfig('value');
    outputData('value', () => value());
  });
}
