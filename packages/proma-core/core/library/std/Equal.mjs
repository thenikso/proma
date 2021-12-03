import eq from '../../../vendor/fast-deep-equal.mjs';

export default function install({ chip, inputData, outputData }) {
  return chip(
    'Equal',
    () => {
      const A = inputData('A', { canonical: true });
      const B = inputData('B', { canonical: true });
      const compute = () => eq(A(), B());
      compute.toString = () => '() => eq(A(), B())';
      const equal = outputData('equal', {
        compute,
        type: 'boolean',
      });
    },
    {
      imports: {
        eq: 'fast-deep-equal',
      },
    },
  );
}
