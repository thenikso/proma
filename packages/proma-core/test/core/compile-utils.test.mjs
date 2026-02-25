import recast from '../../vendor/recast.mjs';
import { describe } from '../runner/riteway.mjs';
import { makeAstBuilder } from '../../core/compile-utils.mjs';
import { info } from '../../core/utils.mjs';

const { builders } = recast.types;

describe('[core/compile-utils] makeAstBuilder regressions', async (assert) => {
  const in1 = {};
  const in2 = {};
  const outA = {};
  const outB = {};

  info(in1, { isFlow: false });
  info(in2, { isFlow: false });
  info(outA, { isFlow: false });
  info(outB, { isFlow: false });

  const chipInfo = {
    getInputPortOutlet(name) {
      return { in1, in2 }[name] || null;
    },
    getOutputPortOutlet(name) {
      return { outA, outB }[name] || null;
    },
  };

  const portInfo = {
    chipInfo,
    execute: function execute() {
      const a = outA(in1());
      const b = outB(in2());
      return [a, b];
    },
  };

  const buildAst = makeAstBuilder(portInfo);
  const ast = buildAst({
    compileInputData(name) {
      return builders.identifier(`${name}_value`);
    },
    compileOutputFlow() {
      return builders.noop();
    },
    compileOutputData(name, argBlock) {
      return builders.blockStatement([
        builders.expressionStatement(
          builders.callExpression(builders.identifier(`declare_${name}`), [
            argBlock,
          ]),
        ),
        builders.expressionStatement(
          builders.callExpression(builders.identifier(`read_${name}`), []),
        ),
      ]);
    },
  });

  const compiled = recast.print(ast).code;
  const order = [
    compiled.indexOf('declare_outA(in1_value);'),
    compiled.indexOf('const a = read_outA();'),
    compiled.indexOf('declare_outB(in2_value);'),
    compiled.indexOf('const b = read_outB();'),
  ];

  assert({
    given: 'multiple output-data replacements in the same block',
    should: 'inject declarations in statement order',
    actual:
      order.every((x) => x >= 0) &&
      order[0] < order[1] &&
      order[1] < order[2] &&
      order[2] < order[3],
    expected: true,
  });
});
