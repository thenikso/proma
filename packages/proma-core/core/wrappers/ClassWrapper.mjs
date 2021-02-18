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
    return memberExpression(identifier('$in'), identifier(portInfo.name));
  }
  // Generate a call to a continuation wrapper:
  //     this.out.then()
  compileOutputFlowOutlet(portInfo) {
    return callExpression(
      memberExpression(
        memberExpression(thisExpression(), identifier('out')),
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
      memberExpression(identifier('$out'), identifier(portInfo.name)),
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
    compiledIngresses,
    compiledFlowPorts,
    compiledOutputPorts,
    compiledUpdatesOnPorts,
  }) {
    const program = parse(`
      class ${this.chipInfo.name} {
        constructor() {
          const $in = Object.seal({});
          const $out = Object.seal({});
        }
      }
    `);

    const classPath = ['program', 'body', 0, 'body', 'body'];
    const constructorPath = [...classPath, 0, 'value'];
    const constructorBodyPath = [...constructorPath, 'body', 'body'];
    const constructorParams = [...constructorPath, 'params'];
    const inPath = [...constructorBodyPath, 0];
    const outPath = [...constructorBodyPath, 1];
    const sealObjPath = [
      'declarations',
      0,
      'init',
      'arguments',
      0,
      'properties',
    ];

    const body = getPath(program, constructorBodyPath);

    //
    // Inlets
    //

    if (this.inletsByPort.size > 0) {
      for (const { declaration } of this.inletsByPort.values()) {
        body.push(declaration);
      }
    }

    //
    // Inputs
    //

    const thisIn = parse('Object.defineProperties((this.in = {}), {});').program
      .body[0];
    const thisInBody = getPath(thisIn, [
      'expression',
      'arguments',
      1,
      'properties',
    ]);

    let hasInData = false;
    let hasInAccess = false;

    if (this.chipInfo.inputDataPorts.length > 0) {
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
      hasInData = true;

      // Input accessors
      thisInBody.push(
        ...this.chipInfo.inputDataPorts.map((portInfo) => {
          return property(
            'init',
            identifier(portInfo.name),
            objectExpression([
              property(
                'init',
                identifier('get'),
                parse(`() => () => $in.${portInfo.name}`).program.body[0]
                  .expression,
              ),
              property(
                'init',
                identifier('set'),
                parse(`(value) => { $in.${portInfo.name} = value }`).program
                  .body[0].expression,
              ),
            ]),
          );
        }),
      );
      hasInAccess = true;

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

    // Input flows (execs)

    if (this.chipInfo.inputFlowPorts.length > 0) {
      thisInBody.push(
        ...this.chipInfo.inputFlowPorts.map((portInfo) => {
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
      hasInAccess = true;
    }

    // No input storage
    if (!hasInData) {
      replaceAstPath(program, inPath, noop());
    }

    // Add input accessors to prorgam
    if (hasInAccess) {
      body.push(thisIn);
      body.push(parse('Object.freeze(this.in)').program.body[0]);
    }

    //
    // Outputs
    //

    const thisOut = parse('Object.defineProperties((this.out = {}), {});')
      .program.body[0];
    const thisOutBody = getPath(thisOut, [
      'expression',
      'arguments',
      1,
      'properties',
    ]);
    const this$OutBody = getPath(program, [...outPath, ...sealObjPath]);

    let hasOutData = false;
    let hasOutAccess = false;

    // Data outputs with no compute (aka output data storage)
    const plainOutputDataPorts = this.chipInfo.outputDataPorts.filter(
      (portInfo) => !compiledOutputPorts[portInfo.name],
    );
    if (plainOutputDataPorts.length > 0) {
      // Regular outputs
      this$OutBody.push(
        ...plainOutputDataPorts.map((portInfo) => {
          return property(
            'init',
            identifier(portInfo.name),
            identifier('undefined'),
          );
        }),
      );
      hasOutData = true;

      // Input accessors
      thisOutBody.push(
        ...plainOutputDataPorts.map((portInfo) => {
          return property(
            'init',
            identifier(portInfo.name),
            objectExpression([
              property(
                'init',
                identifier('value'),
                parse(`() => $out.${portInfo.name}`).program.body[0].expression,
              ),
            ]),
          );
        }),
      );
    }

    // Computed outputs
    const compiledOutputPortsEntries = Object.entries(compiledOutputPorts);
    if (compiledOutputPortsEntries.length > 0) {
      thisOutBody.push(
        ...compiledOutputPortsEntries.map(([portName, block]) =>
          property(
            'init',
            identifier(portName),
            objectExpression([
              property('init', identifier('enumerable'), literal(true)),
              property(
                'init',
                identifier('value'),
                arrowFunctionExpression([], block),
              ),
            ]),
          ),
        ),
      );
      hasOutAccess = true;
    }

    // Output flows
    if (this.chipInfo.outputFlowPorts.length > 0) {
      // Add continuations inits in `$out = { ... }`
      this$OutBody.push(
        ...this.chipInfo.outputFlowPorts.map((portInfo) => {
          return property(
            'init',
            identifier(portInfo.name),
            identifier('undefined'),
          );
        }),
      );
      hasOutData = true;

      // Add this.out` functions to wrap continuations
      thisOutBody.push(
        ...this.chipInfo.outputFlowPorts.map((portInfo) =>
          property(
            'init',
            identifier(portInfo.name),
            objectExpression([
              property(
                'init',
                identifier('value'),
                arrowFunctionExpression(
                  [identifier('value')],
                  blockStatement([
                    //
                    parse(`() => { if (typeof value !== "undefined") {
                      $out.${portInfo.name} = value;
                      return;
                    }}`).program.body[0].expression.body.body[0],
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
                            identifier('$out'),
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
      hasOutAccess = true;
    }

    // Fix output storage
    if (!hasOutData) {
      replaceAstPath(program, outPath, noop());
    }

    // Add output access
    if (hasOutAccess) {
      body.push(thisOut);
      body.push(parse('Object.seal(this.out)').program.body[0]);
    }

    // Ingresses

    for (const [ingressChip, ingressBlock] of compiledIngresses.entries()) {
      const ingressType = ingressChip.type;
      switch (ingressType) {
        case 'OnCreateIngress':
          if (namedTypes.BlockStatement.check(ingressBlock)) {
            body.push(...ingressBlock.body);
          } else if (!namedTypes.ExpressionStatement.check(ingressBlock)) {
            // TODO move this to compile?
            body.push(expressionStatement(ingressBlock));
          } else {
            body.push(ingressBlock);
          }
          break;
        default:
          console.warn(`Unsupported ingress: ${ingressType}`);
          break;
      }
    }

    return cleanAst(program);
  }
}
