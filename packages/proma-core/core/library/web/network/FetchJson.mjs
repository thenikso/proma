export default function install({
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
}) {
  return chip('network/FetchJson', () => {
    const exec = inputFlow('exec', async () => {
      try {
        const res = await fetch(url());
        const data = await res.json();
        json(data);
        error(null);
      } catch (e) {
        json(null);
        error(e);
      }
      then();
    });
    const url = inputData('url', { canonical: true, type: 'String' });

    const then = outputFlow('then');
    const json = outputData('json', 'Object | null');
    const error = outputData('error', 'Error | null');
  });
}
