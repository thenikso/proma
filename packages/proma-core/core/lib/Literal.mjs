export default function install({ registry, chip, inputConfig, outputData }) {
  return registry.add(
    chip('lib/Literal', () => {
      const value = inputConfig('value');
      outputData('value', () => value());
    }),
  );
}
