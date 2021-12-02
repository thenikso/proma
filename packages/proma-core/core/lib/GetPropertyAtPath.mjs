export default function install({ registry, chip, inputData, outputData }) {
  return registry.add(
    chip('lib/GetPropertyAtPath', () => {
      const target = inputData('target', { type: 'Object' });
      const path = inputData('path', {
        type: 'String',
        canonical: true,
      });
      const fallback = inputData('fallback', {
        canonical: true,
      });

      const value = outputData('value', {
        compute: () => {
          const ps = path().split('.');
          let cursor = target();
          for (let i = 0, l = ps.length; i < l; i++) {
            if (typeof cursor === 'undefined') {
              return fallback();
            }
            cursor = cursor[ps[i]];
          }
          return cursor;
        },
        inline: false,
      });
    }),
  );
}
