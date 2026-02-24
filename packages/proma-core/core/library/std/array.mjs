export default function install({ chip, inputFlow, inputData, outputFlow, outputData }) {

  const ForEach = chip('array/ForEach', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        const arr = array();
        for (let i = 0; i < arr.length; i++) {
          element(arr[i]);
          index(i);
          body();
        }
        completed();
      },
    });
    const array = inputData('array', { canonical: true });
    const body = outputFlow('body');
    const completed = outputFlow('completed');
    const element = outputData('element');
    const index = outputData('index', { type: 'number' });
  });

  const Map = chip('array/Map', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        const arr = array();
        const results = [];
        for (let i = 0; i < arr.length; i++) {
          element(arr[i]);
          index(i);
          body();
          results.push(mappedValue());
        }
        output(results);
        completed();
      },
    });
    const array = inputData('array', { canonical: true });
    const mappedValue = inputData('mappedValue');
    const body = outputFlow('body');
    const completed = outputFlow('completed');
    const element = outputData('element');
    const index = outputData('index', { type: 'number' });
    const output = outputData('output');
  });

  const Filter = chip('array/Filter', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        const arr = array();
        const results = [];
        for (let i = 0; i < arr.length; i++) {
          element(arr[i]);
          index(i);
          body();
          if (condition()) {
            results.push(arr[i]);
          }
        }
        output(results);
        completed();
      },
    });
    const array = inputData('array', { canonical: true });
    const condition = inputData('condition', { defaultValue: false, type: 'boolean' });
    const body = outputFlow('body');
    const completed = outputFlow('completed');
    const element = outputData('element');
    const index = outputData('index', { type: 'number' });
    const output = outputData('output');
  });

  const Reduce = chip('array/Reduce', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        const arr = array();
        let acc = initialValue();
        for (let i = 0; i < arr.length; i++) {
          element(arr[i]);
          index(i);
          accumulator(acc);
          body();
          acc = result();
        }
        output(acc);
        completed();
      },
    });
    const array = inputData('array', { canonical: true });
    const initialValue = inputData('initialValue', { canonical: true });
    const result = inputData('result');
    const body = outputFlow('body');
    const completed = outputFlow('completed');
    const element = outputData('element');
    const index = outputData('index', { type: 'number' });
    const accumulator = outputData('accumulator');
    const output = outputData('output');
  });

  return { ForEach, Map, Filter, Reduce };
}
