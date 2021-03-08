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
    this.inletsByPort.clear();
  }
  // Retrieve a reference of an input data outlet
  compileInputDataOutlet(port) {
    return memberExpression(identifier('$in'), identifier(port.name));
  }
  // Generate a call to a continuation wrapper:
  //     this.out.then()
  compileOutputFlowOutlet(port) {
    return callExpression(
      memberExpression(
        memberExpression(thisExpression(), identifier('out')),
        identifier(port.name),
      ),
      [],
    );
  }
  // Generate an assignment to an outlet:
  //
  //     $out.value = <assignExpressionBlock>
  //
  // Or an access to that outlet if no assign expression is specified
  //
  //     $out.value
  //
  compileOutputDataOutlet(port, assignExpressionBlock) {
    const outletUse = memberExpression(
      identifier('$out'),
      identifier(port.name),
    );
    if (!assignExpressionBlock) return outletUse;
    return assignmentExpression('=', outletUse, assignExpressionBlock);
  }
  // An inlet is an outlet of an instanced port. It will need local storage
  // provided by the wrapper main body.
  // Used to generate chip instances' `computeOn` output ports. Should generate
  // something like:
  //
  //     // To add to the wrapper main body
  //     let InnerChip_1__outputPort;
  //     // To return with this function
  //     InnerChip_1__outputPort = <assignExpressionBlock>
  //
  // Or an access to the generated inlet variable if no assign expression is given:
  //
  //     InnerChip_1__outputPort
  //
  compileVariableInlet(port, assignExpressionBlock, kind = 'let') {
    let inletUse;
    if (this.inletsByPort.has(port)) {
      inletUse = this.inletsByPort.get(port).use;
    } else {
      inletUse = identifier(
        `${(port.chip && port.chip.id) || '$'}__${port.name}`,
      );
      if (kind === 'let') {
        const declaration = variableDeclaration('let', [
          variableDeclarator(inletUse, null),
        ]);
        this.inletsByPort.set(port, {
          use: inletUse,
          declaration,
        });
      } else if (assignExpressionBlock) {
        const declaration = variableDeclaration('const', [
          variableDeclarator(inletUse, assignExpressionBlock),
        ]);
        this.inletsByPort.set(port, {
          use: inletUse,
          declaration,
        });
      }
    }
    if (kind === 'let' && assignExpressionBlock) {
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
        if (!namedTypes.ArrowFunctionExpression.check(funcBlock)) {
          funcBlock = arrowFunctionExpression([], funcBlock);
        }
        const declaration = variableDeclaration('const', [
          variableDeclarator(inletIdenfitier, funcBlock),
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
    compiledHooks,
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
        this.chipInfo.inputDataPorts.map((portOutlet) => {
          let init = identifier('undefined');
          const port = this.chip && this.chip.in[portOutlet.name];
          if (portOutlet.canonical) {
            canonical.push([
              portOutlet.name,
              port && port.defaultValue !== port.value ? port.value : undefined,
            ]);
            if (port && typeof port.defaultValue !== 'undefined') {
              init = logicalExpression(
                '||',
                identifier(portOutlet.name),
                literalCompiler(port.defaultValue),
              );
            } else {
              init = null;
            }
          } else if (port) {
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
            identifier(portOutlet.name),
            init || identifier(portOutlet.name),
          );
          res.shorthand = !init;
          return res;
        }),
      );
      hasInData = true;

      // Input accessors
      thisInBody.push(
        ...this.chipInfo.inputDataPorts.map((portOutlet) => {
          const inProps = [
            property(
              'init',
              identifier('get'),
              parse(`() => () => $in.${portOutlet.name}`).program.body[0]
                .expression,
            ),
          ];
          if (!portOutlet.isHidden) {
            inProps.push(
              property(
                'init',
                identifier('set'),
                parse(`(value) => { $in.${portOutlet.name} = value }`).program
                  .body[0].expression,
              ),
            );
          }
          return property(
            'init',
            identifier(portOutlet.name),
            objectExpression(inProps),
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
        ...this.chipInfo.inputFlowPorts.map((portOutlet) => {
          let flowBlock = compiledFlowPorts[portOutlet.name];
          if (!flowBlock) {
            // TODO connected flow?
            return noop();
          }
          if (!namedTypes.BlockStatement.check(flowBlock)) {
            if (!namedTypes.ExpressionStatement.check(flowBlock)) {
              flowBlock = expressionStatement(flowBlock);
            }
            flowBlock = blockStatement([flowBlock]);
          }
          return property(
            'init',
            identifier(portOutlet.name),
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
      (portOutlet) => !compiledOutputPorts[portOutlet.name],
    );
    if (plainOutputDataPorts.length > 0) {
      // Regular outputs
      this$OutBody.push(
        ...plainOutputDataPorts.map((portOutlet) => {
          return property(
            'init',
            identifier(portOutlet.name),
            identifier('undefined'),
          );
        }),
      );
      hasOutData = true;

      // Input accessors
      thisOutBody.push(
        ...plainOutputDataPorts.map((portOutlet) => {
          return property(
            'init',
            identifier(portOutlet.name),
            objectExpression([
              property(
                'init',
                identifier('value'),
                parse(`() => $out.${portOutlet.name}`).program.body[0]
                  .expression,
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
        ...this.chipInfo.outputFlowPorts.map((portOutlet) => {
          return property(
            'init',
            identifier(portOutlet.name),
            identifier('undefined'),
          );
        }),
      );
      hasOutData = true;

      // Add this.out` functions to wrap continuations
      thisOutBody.push(
        ...this.chipInfo.outputFlowPorts.map((portOutlet) =>
          property(
            'init',
            identifier(portOutlet.name),
            objectExpression([
              property(
                'init',
                identifier('value'),
                arrowFunctionExpression(
                  [identifier('value')],
                  blockStatement([
                    // Add output continuation set trap
                    parse(`() => { if (typeof value !== "undefined") {
                      $out.${portOutlet.name} = value;
                      return;
                    }}`).program.body[0].expression.body.body[0],
                    // Update output ports with `computeOn` connected to this
                    // flow outlet
                    ...(
                      compiledUpdatesOnPorts[portOutlet.name] || []
                    ).map((b) => expressionStatement(b)),
                    // TODO add output updates here
                    expressionStatement(
                      callExpression(
                        logicalExpression(
                          '||',
                          memberExpression(
                            identifier('$out'),
                            identifier(portOutlet.name),
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
      body.push(parse('Object.freeze(this.out)').program.body[0]);
    }

    // Destroy method
    const destroyMethod = parse(
      `Object.defineProperty(this, "destroy", { value: () => {} })`,
    ).program.body[0];
    const destroyBodyPath = [
      'expression',
      'arguments',
      2,
      'properties',
      0,
      'value',
      'body',
    ];

    // Hooks

    for (const [hookLabel, hookBlocks] of Object.entries(compiledHooks || {})) {
      switch (hookLabel) {
        case 'onCreate':
          // TODO could remove outter block if there are no variable declarations
          body.push(...hookBlocks);
          break;
        case 'onDestroy':
          replaceAstPath(
            destroyMethod,
            destroyBodyPath,
            // TODO could remove outter block if there are no variable declarations
            blockStatement(hookBlocks),
          );
          break;
        default:
          console.warn(`Unsupported hook: ${hookLabel}`);
          break;
      }
    }

    // Always add destroy method (even if emtpy)
    body.push(destroyMethod);

    return cleanAst(program);
  }
}
