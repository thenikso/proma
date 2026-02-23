export default function install({
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
}) {
  const Await = chip('async/Await', () => {
    const exec = inputFlow('exec', {
      execute: async () => {
        try {
          const value = await promise();
          result(value);
          then();
        } catch (err) {
          error(err);
          onCatch();
        }
      },
    });
    const promise = inputData('promise', { canonical: true });
    const then = outputFlow('then');
    const onCatch = outputFlow('onCatch');
    const result = outputData('result');
    const error = outputData('error');
  });

  const Delay = chip('async/Delay', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        setTimeout(() => {
          then();
        }, duration());
      },
    });
    const duration = inputData('duration', {
      canonical: true,
      defaultValue: 0,
      type: 'number',
    });
    const then = outputFlow('then');
  });

  const Debounce = chip('async/Debounce', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        clearTimeout(_timer());
        const t = setTimeout(() => {
          then();
        }, delay());
        _timer(t);
      },
    });
    const delay = inputData('delay', {
      canonical: true,
      defaultValue: 300,
      type: 'number',
    });
    const then = outputFlow('then');
    const _timer = outputData('_timer', {
      conceiled: 'hidden',
      defaultValue: undefined,
    });
  });

  const Throttle = chip('async/Throttle', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        if (!_throttled()) {
          then();
          _throttled(true);
          setTimeout(() => {
            _throttled(false);
          }, interval());
        }
      },
    });
    const interval = inputData('interval', {
      canonical: true,
      defaultValue: 300,
      type: 'number',
    });
    const then = outputFlow('then');
    const _throttled = outputData('_throttled', {
      conceiled: 'hidden',
      defaultValue: false,
    });
  });

  return { Await, Delay, Debounce, Throttle };
}
