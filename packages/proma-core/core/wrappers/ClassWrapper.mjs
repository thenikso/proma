import recast from '../../vendor/recast.mjs';
import {
  getPath,
  replaceAstPath,
  literalCompiler,
  cleanAst,
} from '../compile-utils.mjs';

const {
  parse,
  types: { namedTypes, builders },
} = recast;

const {
  arrowFunctionExpression,
  assignmentExpression,
  assignmentPattern,
  blockStatement,
  callExpression,
  expressionStatement,
  functionDeclaration,
  functionExpression,
  identifier,
  literal,
  logicalExpression,
  memberExpression,
  methodDefinition,
  noop,
  objectExpression,
  property,
  thisExpression,
  variableDeclaration,
  variableDeclarator,
} = builders;

export default class ClassWrapper {
  constructor() {
    this.chip = null;
    this.chipInfo = null;
    this.inletsByPort = new Map();
  }
  compileBegin(chip, chipInfo) {
    this.chip = chip;
    this.chipInfo = chipInfo;
    // TODO reset inlets
  }
  compileInputDataOutlet(portInfo) {
    return memberExpression(
      memberExpression(thisExpression(), identifier('in')),
      identifier(portInfo.name),
    );
  }
  // Generate a call to a continuation wrapper:
  //     this.$cont.then()
  compileOutputFlowOutlet(portInfo) {
    return callExpression(
      memberExpression(
        memberExpression(thisExpression(), identifier('$cont')),
        identifier(portInfo.name),
      ),
      [],
    );
  }
  // Generate an assignment to an outlet:
  //     this.out.value = <assignExpressionBlock>
  compileOutputDataOutlet(portInfo, assignExpressionBlock) {
    return assignmentExpression(
      '=',
      memberExpression(
        memberExpression(thisExpression(), identifier('out')),
        identifier(portInfo.name),
      ),
      assignExpressionBlock,
    );
  }
  // An inlet is an outlet of an instanced port. It will need local storage
  // provided by the wrapper main body.
  // Used to generate chip instances' `computeOn` output ports. Should generate
  // something like:
  //     // To add to the wrapper main body
  //     let InnerChip_1__outputPort;
  //     // To return with this function
  //     InnerChip_1__outputPort = <assignExpressionBlock>
  compileVariableInlet(port, assignExpressionBlock) {
    let inletUse;
    if (this.inletsByPort.has(port)) {
      inletUse = this.inletsByPort.get(port).use;
    } else {
      inletUse = identifier(`${port.chip.id}__${port.name}`);
      const declaration = variableDeclaration('let', [
        variableDeclarator(inletUse, null),
      ]);
      this.inletsByPort.set(port, {
        use: inletUse,
        declaration,
      });
    }
    if (assignExpressionBlock) {
      return assignmentExpression('=', inletUse, assignExpressionBlock);
    }
    return inletUse;
  }
  // An inlet for an input flow is a function that can be used multiple times
  compileFunctionInlet(port, funcBlock) {
    let inletUse;
    if (this.inletsByPort.has(port)) {
      inletUse = this.inletsByPort.get(port).use;
      // if (funcBlock) {
      //   // TODO we should check that the definition is not changing
      // }
    } else {
      const inletIdenfitier = identifier(
        `${(port.chip && port.chip.id) || '$'}__${port.name}`,
      );
      inletUse = callExpression(inletIdenfitier, []);
      if (funcBlock) {
        const declaration = variableDeclaration('const', [
          variableDeclarator(
            inletIdenfitier,
            arrowFunctionExpression([], funcBlock),
          ),
        ]);
        this.inletsByPort.set(port, {
          use: inletUse,
          declaration,
        });
      }
    }
    return inletUse;
  }
  compileEnd({
    compiledEmitters,
    compiledFlowPorts,
    compiledOutputPorts,
    compiledUpdatesOnPorts,
  }) {
    const program = parse(`
      class ${this.chipInfo.name} {
        constructor() {
          this.in = Object.seal({});
          this.out = {};
          this.cont = Object.seal({});
        }
      }
    `);

    // console.log(program);
    // return program;

    const classPath = ['program', 'body', 0, 'body', 'body'];
    const constructorPath = [...classPath, 0, 'value'];
    const constructorBodyPath = [...constructorPath, 'body', 'body'];
    const constructorParams = [...constructorPath, 'params'];
    const inPath = [...constructorBodyPath, 0];
    const outPath = [...constructorBodyPath, 1];
    const contPath = [...constructorBodyPath, 2];
    const objPath = ['expression', 'right', 'properties'];
    const sealObjPath = ['expression', 'right', 'arguments', 0, 'properties'];

    const body = getPath(program, constructorBodyPath);

    if (this.chipInfo.inputDataPorts.length === 0) {
      replaceAstPath(program, inPath, noop());
    } else {
      const canonical = [];
      replaceAstPath(
        program,
        [...inPath, ...sealObjPath],
        this.chipInfo.inputDataPorts.map((portInfo) => {
          let init = identifier('undefined');
          const port = this.chip.in[portInfo.name];
          if (portInfo.canonical) {
            canonical.push([
              portInfo.name,
              port.defaultValue !== port.value ? port.value : undefined,
            ]);
            if (typeof port.defaultValue !== 'undefined') {
              init = logicalExpression(
                '||',
                identifier(portInfo.name),
                literalCompiler(port.defaultValue),
              );
            } else {
              init = null;
            }
          } else {
            if (typeof port.value !== 'undefined') {
              if (
                typeof port.defaultValue !== 'undefined' &&
                port.value !== port.defaultValue
              ) {
                init = logicalExpression(
                  '||',
                  literalCompiler(port.value),
                  literalCompiler(port.defaultValue),
                );
              } else {
                init = literalCompiler(port.value);
              }
            }
          }
          const res = property(
            'init',
            identifier(portInfo.name),
            init || identifier(portInfo.name),
          );
          res.shorthand = !init;
          return res;
        }),
      );
      // TODO Actually we want getter/setter for input to return default value

      // Add canonical constructor arguments
      if (canonical.length > 0) {
        replaceAstPath(
          program,
          constructorParams,
          canonical.map(([portName, value]) => {
            if (typeof value !== 'undefined') {
              return assignmentPattern(
                identifier(portName),
                literalCompiler(value),
              );
            }
            return identifier(portName);
          }),
        );
      }
    }

    // Inlets

    if (this.inletsByPort.size > 0) {
      for (const { declaration } of this.inletsByPort.values()) {
        body.push(declaration);
      }
    }

    // Outputs

    if (this.chipInfo.outputDataPorts.length === 0) {
      replaceAstPath(program, outPath, noop());
    } else {
      const compiledOutputPortsEntries = Object.entries(compiledOutputPorts);
      if (compiledOutputPortsEntries.length > 0) {
        const outputGetters = parse('Object.defineProperties(this.out, {});')
          .program.body[0];
        replaceAstPath(
          outputGetters,
          ['expression', 'arguments', 1, 'properties'],
          compiledOutputPortsEntries.map(([portName, block]) =>
            property(
              'init',
              identifier(portName),
              objectExpression([
                property('init', identifier('enumerable'), literal(true)),
                property(
                  'init',
                  identifier('get'),
                  arrowFunctionExpression([], block),
                ),
              ]),
            ),
          ),
        );
        body.push(outputGetters);
      }
      if (!this.chipInfo.isFlowless) {
        // Add `this.out` values
        replaceAstPath(
          program,
          [...outPath, ...objPath],
          this.chipInfo.outputDataPorts
            .filter((portInfo) => !compiledOutputPorts[portInfo.name])
            .map((portInfo) => {
              return property(
                'init',
                identifier(portInfo.name),
                identifier('undefined'),
              );
            }),
        );
      }
      // Seal this.out
      body.push(parse('Object.seal(this.out)').program.body[0]);
    }

    // Output flows

    if (this.chipInfo.outputFlowPorts.length === 0) {
      replaceAstPath(program, contPath, noop());
    } else {
      // Add continuations inits in `this.cont = { ... }`
      replaceAstPath(
        program,
        [...contPath, ...sealObjPath],
        this.chipInfo.outputFlowPorts.map((portInfo) => {
          return property(
            'init',
            identifier(portInfo.name),
            identifier('undefined'),
          );
        }),
      );

      // Add `$cont` functions to wrap continuations
      const $$contGetters = parse(
        'Object.defineProperties((this.$cont = {}), {});',
      ).program.body[0];
      replaceAstPath(
        $$contGetters,
        ['expression', 'arguments', 1, 'properties'],
        this.chipInfo.outputFlowPorts.map((portInfo) =>
          property(
            'init',
            identifier(portInfo.name),
            objectExpression([
              property(
                'init',
                identifier('value'),
                arrowFunctionExpression(
                  [],
                  blockStatement([
                    // Update output ports with `computeOn` connected to this
                    // flow outlet
                    ...(compiledUpdatesOnPorts[portInfo.name] || []).map((b) =>
                      expressionStatement(b),
                    ),
                    // TODO add output updates here
                    expressionStatement(
                      callExpression(
                        logicalExpression(
                          '||',
                          memberExpression(
                            memberExpression(
                              thisExpression(),
                              identifier('cont'),
                            ),
                            identifier(portInfo.name),
                          ),
                          arrowFunctionExpression([], blockStatement([])),
                        ),
                        [],
                      ),
                    ),
                  ]),
                ),
              ),
            ]),
          ),
        ),
      );
      body.push($$contGetters);
    }

    // Emitters

    for (const emitterBlock of compiledEmitters) {
      body.push(emitterBlock);
    }

    // Input flows (execs)

    if (this.chipInfo.inputFlowPorts.length > 0) {
      // TODO
      const execs = parse('Object.defineProperties(this, {});').program.body[0];
      replaceAstPath(
        execs,
        ['expression', 'arguments', 1, 'properties'],
        this.chipInfo.inputFlowPorts.map((portInfo) => {
          let flowBlock = compiledFlowPorts[portInfo.name];
          if (!flowBlock) {
            // TODO connected flow?
            throw new Error('unimplemented');
          }
          if (!namedTypes.BlockStatement.check(flowBlock)) {
            if (!namedTypes.ExpressionStatement.check(flowBlock)) {
              flowBlock = expressionStatement(flowBlock);
            }
            flowBlock = blockStatement([flowBlock]);
          }
          return property(
            'init',
            identifier(portInfo.name),
            objectExpression([
              property(
                'init',
                identifier('value'),
                arrowFunctionExpression([], flowBlock),
              ),
            ]),
          );
        }),
      );
      body.push(execs);
    }

    return cleanAst(program);
  }
}
