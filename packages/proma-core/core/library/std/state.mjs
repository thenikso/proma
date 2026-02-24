export default function install({
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
}) {
  // State: A reactive variable with get/set and change notification
  const State = chip('state/State', () => {
    const set = inputFlow('set', {
      execute: () => {
        _previousValue(value());
        _value(newValue());
        onChange();
      },
    });
    const initialValue = inputData('initialValue', { canonical: true });
    const newValue = inputData('newValue');

    const onChange = outputFlow('onChange');

    // Public readable outputs
    const value = outputData('value', {
      compute: () => {
        const v = _value();
        return typeof v !== 'undefined' ? v : initialValue();
      },
    });
    const previousValue = outputData('previousValue', {
      compute: () => _previousValue(),
    });

    // Internal state storage
    const _value = outputData('_value', { concealed: 'hidden' });
    const _previousValue = outputData('_previousValue', { concealed: 'hidden' });
  });

  // Gate: Only fires "then" if condition is true when exec is called
  const Gate = chip('state/Gate', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        if (condition()) {
          then();
        }
      },
    });
    const condition = inputData('condition', {
      canonical: true,
      defaultValue: false,
      type: 'boolean',
    });
    const then = outputFlow('then');
  });

  // Counter: Increments/decrements an internal counter
  const Counter = chip('state/Counter', () => {
    const increment = inputFlow('increment', {
      execute: () => {
        _count(count() + step());
        onChange();
      },
    });
    const decrement = inputFlow('decrement', {
      execute: () => {
        _count(count() - step());
        onChange();
      },
    });
    const reset = inputFlow('reset', {
      execute: () => {
        _count(initialValue());
        onChange();
      },
    });

    const initialValue = inputData('initialValue', {
      canonical: true,
      defaultValue: 0,
      type: 'number',
    });
    const step = inputData('step', {
      canonical: true,
      defaultValue: 1,
      type: 'number',
    });

    const onChange = outputFlow('onChange');
    const count = outputData('count', {
      compute: () => {
        const v = _count();
        return typeof v !== 'undefined' ? v : initialValue();
      },
      type: 'number',
    });

    const _count = outputData('_count', { concealed: 'hidden' });
  });

  // Toggle: Boolean state that toggles on exec
  const Toggle = chip('state/Toggle', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        _value(!_value());
        onChange();
      },
    });
    const setTrue = inputFlow('setTrue', {
      execute: () => {
        _value(true);
        onChange();
      },
    });
    const setFalse = inputFlow('setFalse', {
      execute: () => {
        _value(false);
        onChange();
      },
    });

    const initialValue = inputData('initialValue', {
      canonical: true,
      defaultValue: false,
      type: 'boolean',
    });

    const onChange = outputFlow('onChange');
    const value = outputData('value', {
      compute: () => {
        const v = _value();
        return typeof v !== 'undefined' ? v : initialValue();
      },
      type: 'boolean',
    });

    const _value = outputData('_value', { concealed: 'hidden' });
  });

  return { State, Gate, Counter, Toggle };
}
