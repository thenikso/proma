export default function install({
  registry,
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
}) {
  return registry.add(
    chip('lib/network/FetchJson', () => {
      const exec = inputFlow('exec', () => {
        fetch(url())
          .then((res) => res.json())
          .then((res) => {
            json(res);
            error(null);
            then();
          })
          .catch((e) => {
            json(null);
            error(e);
            then();
          });
      });
      const url = inputData('url', { canonical: true, type: 'String' });

      const then = outputFlow('then');
      const json = outputData('json', 'Object');
      const error = outputData('error', 'Error');
    }),
  );
}
