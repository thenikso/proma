import recast from '../vendor/recast.mjs';
import { info, context, assert, assertInfo } from './utils.mjs';
import ClassWrapper from './wrappers/ClassWrapper.mjs';
import {
  literalCompiler,
  getFunctionBody,
  pathFromNodePath,
  getPath,
  replaceAstPath,
  makeAstBuilder,
  cleanAst,
} from './compile-utils.mjs';

const {
  prettyPrint,
  types: { namedTypes, builders },
} = recast;

export class Compilation {
  constructor(rootChipInfo, rootChip, CodeWrapper) {
    this.rootChip = rootChip;
    this.rootChipInfo = rootChipInfo;
    this.outputBlocksByPort = {};
    this.executeBlocksByPort = {};
    this.ingressBlocksByChip = new Map();
    this.updateBlocksByPort = {};
    this.CodeWrapper = CodeWrapper || ClassWrapper;
  }

  compile(codeWrapper) {
    codeWrapper = codeWrapper || new (this.CodeWrapper || ClassWrapper)();

    // TODO compile each input exec ports
    const rootInfo = this.rootChipInfo;
    const rootChip = this.rootChip || info({}, this.rootChipInfo);
    const scope = [rootChip];

    if (codeWrapper.compileBegin) {
      codeWrapper.compileBegin(this.rootChip, this.rootChipInfo);
    }

    if (rootInfo.isFlowless) {
      // "Pure" chips

      // Outputs

      for (const portInfo of rootInfo.outputDataPorts) {
        const block = compiler(portInfo)(null, scope, codeWrapper);
        this.outputBlocksByPort[portInfo.name] = block;
      }
    } else {
      // Chips with flow may have ingresses or executions

      // Output data with compute but no computeOn will be initialized once
      // This covers stuff like handlers
      for (const portInfo of rootInfo.outputDataPorts) {
        if (portInfo.compute && portInfo.computeOn.length === 0) {
          const block = compiler(portInfo)(null, scope, codeWrapper);
          this.outputBlocksByPort[portInfo.name] = block;
        }
      }

      // Output flows

      for (const portInfo of rootInfo.outputFlowPorts) {
        if (portInfo.computeOutputs.length === 0) continue;

        this.updateBlocksByPort[portInfo.name] = portInfo.computeOutputs.map(
          (outPortInfo) => {
            return compiler(outPortInfo)(null, scope, codeWrapper);
          },
        );
      }

      // Executions

      for (const portInfo of rootInfo.inputFlowPorts) {
        const block = compiler(portInfo)(null, scope, codeWrapper);
        this.executeBlocksByPort[portInfo.name] = block;
      }

      // Ingresses
      for (const { port, scope } of usedIngresses(rootChip)) {
        this.ingressBlocksByChip.set(
          // TODO maybe give different informations here? just the port.chip?
          // eventually a wrapper will want to properly hook them up. the
          // name might not be a good enough clue
          port.chip,
          compile(port, scope, codeWrapper),
        );
      }
    }

    // Build the final program
    const program = codeWrapper.compileEnd({
      chip: this.rootChip,
      chipInfo: this.rootChipInfo,
      compiledIngresses: this.ingressBlocksByChip,
      compiledFlowPorts: this.executeBlocksByPort,
      compiledOutputPorts: this.outputBlocksByPort,
      compiledUpdatesOnPorts: this.updateBlocksByPort,
    });

    return prettyPrint(program, { tabWidth: 2 }).code;
  }

  toString() {
    return this.compile();
  }
}

//
// Visiting
//

function usedIngresses(chip, scope) {
  if (!scope) {
    scope = [chip];
  }
  const ingresses = [];
  const chipInfo = info(chip);
  for (const ingress of chipInfo.ingresses) {
    if (!chipInfo.chips.includes(ingress)) {
      continue;
    }
    const newScope = [ingress, ...scope];
    const outFlowPorts = ingress.out.filter((port) => info(port).isFlow);
    for (const port of outFlowPorts) {
      ingresses.push({
        port,
        scope: newScope,
      });
    }
  }
  for (const subChip of chipInfo.chips) {
    ingresses.push(...usedIngresses(subChip, [subChip, ...scope]));
  }
  return ingresses;
}

function isOutlet(portInfo, scope) {
  const rootInfo = info(scope[scope.length - 1]);
  return rootInfo === portInfo.chipInfo;
}

//
// Compilers
//

function compile(port, scope, codeWrapper) {
  return compiler(info(port))(port, scope, codeWrapper);
}

// Get the compiler for a port
function compiler(portInfo) {
  if (portInfo.compiler) return portInfo.compiler;
  if (portInfo.isFlow) {
    if (portInfo.isInput) {
      portInfo.compiler = makeInputFlowSourceCompiler(portInfo);
    } else {
      portInfo.compiler = makeOutputFlowSinkCompiler(portInfo);
    }
  } else {
    if (portInfo.isInput) {
      portInfo.compiler = makeInputDataSinkCompiler(portInfo);
    } else {
      portInfo.compiler = makeOutputDataSourceCompiler(portInfo);
    }
  }
  return portInfo.compiler;
}

function computeCompiler(
  portInfo,
  prop = 'compute',
  compilerProp = 'computeCompiler',
) {
  if (portInfo[compilerProp]) return portInfo[compilerProp];

  // Creating the ast for the `compute` function of the output port. Note that
  // this should be pure, aka it should return a deterministic value based on
  // any combination of input ports.
  // TODO we need to check for purity (ie: can only use inputs)
  const astBuilder = makeAstBuilder(portInfo, prop);

  portInfo[compilerProp] = function compileCompute(
    portInstance,
    outterScope,
    codeWrapper,
  ) {
    const [chip, ...scope] = outterScope;
    assertInfo(chip, portInfo.chipInfo);

    return astBuilder({
      // Input data ports are compiled in
      compileInputData(portName) {
        const port = chip.in[portName];
        return compile(port, [chip, ...scope], codeWrapper);
      },
      // This should not happen
      compileOutputFlow(portName) {
        throw new Error('Can not use output flow ports in a compute');
      },
      // This should not happen
      compileOutputData(portName, assignExpressionBlock) {
        throw new Error('Can not use output data ports in a compute');
      },
    });
  };

  return portInfo[compilerProp];
}

function executeCompiler(
  portInfo,
  prop = 'execute',
  compilerProp = 'executeCompiler',
) {
  if (portInfo[compilerProp]) return portInfo[compilerProp];

  const astBuilder = makeAstBuilder(portInfo, prop);

  portInfo[compilerProp] = function compileExecute(
    portInstance,
    outterScope,
    codeWrapper,
  ) {
    const [chip, ...scope] = outterScope;
    assertInfo(chip, portInfo.chipInfo);

    return astBuilder({
      compileInputData(portName) {
        const port = chip.in[portName];
        return compile(port, [chip, ...scope], codeWrapper);
      },
      compileOutputFlow(portName) {
        // Follow port connections until an exec port it found
        const port = chip.out[portName];
        // TODO verify port? how?

        const portInfo = info(port);
        if (isOutlet(portInfo, outterScope)) {
          return codeWrapper.compileOutputFlowOutlet(portInfo);
        }

        const parentChip = scope[0];
        assert(parentChip, `Port "${port.fullName}" should be an outlet`);

        const conns = info(parentChip).getConnectedPorts(port, parentChip);
        assert(conns.length <= 1, 'unimplemented multi-conns');
        const conn = conns[0];

        if (conn) {
          if (conn.chip !== scope[0]) {
            return compile(conn, [conn.chip, ...scope], codeWrapper);
          }
          return compile(conn, scope, codeWrapper);
        }
      },
      /**
       * Output data in executes are used like so:
       *     portName(assignExpressionBlock);
       * The provided `assignExpressionBlock` is the expression to assign to the
       * output port.
       */
      compileOutputData(portName, assignExpressionBlock) {
        const port = chip.out[portName];
        const portInfo = info(port);

        if (isOutlet(portInfo, outterScope)) {
          return codeWrapper.compileOutputDataOutlet(
            portInfo,
            assignExpressionBlock,
          );
        }

        assert(
          portInfo.computeOn.length === 0,
          `Can not assign to "${
            port.fullName
          }" as it is computed on [${portInfo.computeOn
            .map((p) => p.name)
            .join(', ')}]`,
        );

        // Generate assignment of local variable
        //    let portName = <assignExpressionBlock>;

        const parentChip = scope[0];
        assert(parentChip, `Port "${port.fullName}" should be an outlet`);

        const conns = info(parentChip).getConnectedPorts(port, parentChip);
        assert(conns.length <= 1, 'unimplemented multi-conns');
        const conn = conns[0];

        if (conn) {
          let outputIdentifier;
          if (conn.chip !== scope[0]) {
            outputIdentifier = compile(
              conn,
              [conn.chip, ...scope],
              codeWrapper,
            );
          } else {
            outputIdentifier = compile(conn, scope, codeWrapper);
          }

          assert(
            namedTypes.Identifier.check(outputIdentifier),
            `Expected identifier got: ${outputIdentifier}`,
          );

          return builders.variableDeclaration('let', [
            builders.variableDeclarator(
              outputIdentifier,
              assignExpressionBlock,
            ),
          ]);
        }
      },
    });
  };

  return portInfo[compilerProp];
}

// Output flows ("then" ports)
// These can be connected to a single input flow.
//
//     const then = outputFlow('then');
//
function makeOutputFlowSinkCompiler(portInfo) {
  assert(
    portInfo.isOutput && portInfo.isFlow,
    'Can only create compiler for output flow ports',
  );

  // An output flow could be a forwarding outlet.
  // We follow that up the scope chain to the next connected port or generate a
  // noop if there is no connection.
  // In here we also handle the case of output flows used to update an output
  // data port:
  //
  //     const then = outputFlow('then');
  //     const out = outputData('out', then);
  //
  return function findSourceCompiler(port, outterScope, codeWrapper) {
    const [chip, ...scope] = outterScope;

    assertInfo(port, portInfo);
    assertInfo(chip, portInfo.chipInfo);

    // When compiling an outlet, we just defer to the wrapper. This should
    // generate an execution of the output flow outlet in some fashon.
    if (isOutlet(portInfo, outterScope)) {
      return codeWrapper.compileOutputFlowOutlet(portInfo);
    }

    const parentChip = scope[0];
    assert(parentChip, `Port "${port.fullName}" should be an outlet`);

    const conns = info(parentChip).getConnectedPorts(port, parentChip);
    assert(conns.length <= 1, 'An output flow can only have one connection');
    const conn = conns[0];

    // Continue this output chain by compiling the connected input flow if
    // present.
    let continuation;
    if (conn) {
      continuation = compile(conn, [conn.chip, ...scope], codeWrapper);
    }

    // All right, now we have inlets. This is an output flow that is used
    // by output data to update itself. So when this port is executed
    // we want to update those inlets with the value.
    if (portInfo.computeOutputs.length > 0) {
      const continuationSequence = [];
      // output flow may have multiple output data to update
      for (const computePortInfo of portInfo.computeOutputs) {
        let assignBlock;
        // This is what is also done in `ChipInfo.getConnectedPorts` if an
        // instance is provided. We basically want the instance of the output
        // data port we need to update (but we only have its info)
        const computePortInstance = chip.out[computePortInfo.name];
        // If the output data port to computeOn has a compute function, we use
        // that one. See makeOutputDataSourceCompiler#computeOnCompiler for
        // where the port set here is used.
        if (computePortInfo.compute) {
          assignBlock = computeCompiler(computePortInfo)(
            computePortInstance,
            [computePortInstance.chip, ...scope],
            codeWrapper,
          );
        } else {
          // now we look for the connected input data of the output data port
          // to update and compile it
          const assignPort = info(chip).getConnectedPorts(
            computePortInstance,
            chip,
          )[0];

          assert(assignPort, 'Not connected nor computed??');

          assignBlock = compile(
            assignPort,
            [assignPort.chip, ...scope],
            codeWrapper,
          );
        }
        // We add the assignment (as provided by the wrapper) to the port execution
        if (assignBlock) {
          continuationSequence.push(
            builders.expressionStatement(
              codeWrapper.compileVariableInlet(
                computePortInstance,
                assignBlock,
              ),
            ),
          );
        }
      }
      if (continuation) {
        if (namedTypes.BlockStatement.check(continuation)) {
          continuationSequence.push(...continuation.body);
        } else {
          if (!namedTypes.ExpressionStatement.check(continuation)) {
            continuation = builders.expressionStatement(continuation);
          }
          continuationSequence.push(continuation);
        }
      }
      return builders.blockStatement(continuationSequence);
    }

    return continuation;
  };
}

// Input flows ("exec" ports)
// These can be connected from multiple output flow ports or have an `execute`.
// Execute input flows must call the next output flow(s) by themself.
//
//     const exec = inputFlow('exec');
//     const exec = inputFlow('exec', () => {
//        console.log('side effect');
//        then();
//     });
//
function makeInputFlowSourceCompiler(portInfo) {
  assert(
    portInfo.isInput && portInfo.isFlow,
    'Can only create compiler for input flow ports',
  );

  // When an `execute` is specified, we compile that
  if (portInfo.execute) {
    return function useExecuteCompiler(port, outterScope, codeWrapper) {
      const executeExpression = executeCompiler(portInfo)(
        port,
        outterScope,
        codeWrapper,
      );

      // If this port is connected multiple times, we want this
      // as a function and call to that function instead (inlet)
      if (!isOutlet(portInfo, outterScope)) {
        const [chip, ...scope] = outterScope;
        const parentChip = scope[0];
        const connCount = info(parentChip).getConnectedPorts(port).length;
        if (connCount > 1) {
          return codeWrapper.compileFunctionInlet(port, executeExpression);
        }
      }

      return executeExpression;
    };
  }

  // An input flow without an execute could be a forwarding outlet.
  // We follow that to the next connection or generate a noop if there is
  // no connection.
  return function forwardSourceCompiler(port, outterScope, codeWrapper) {
    // Special cases for outlet compilation
    // TODO perhaps cleanup
    if (isOutlet(portInfo, outterScope)) {
      const rootChip = outterScope[0];
      const conns = info(rootChip).getConnectedPorts(portInfo);
      assert(
        conns.length <= 1,
        'Only one connection is allowed for input flow outlets',
      );
      const conn = conns[0];

      if (!conn) return;

      // Connecting to an output flow outlet (from an input flow outlet)
      //
      //    const exec = inputFlow('exec');
      //    const then = outputFlow('then');
      //    wire(exec, then);
      if (isOutlet(conn, outterScope)) {
        return codeWrapper.compileOutputFlowOutlet(conn);
      }

      // We have a connection to an output flow
      //
      //     const exec = inputFlow('exec');
      //     const log = Log();
      //     wire(exec, log.in.exec);
      //
      // Compile that in place of this input flow.
      return compile(conn, [conn.chip, ...outterScope], codeWrapper);
    }

    // If not an outlet, then we follow the connections in the upstream direction
    // input flow -> output flow and compile what we find

    assertInfo(port, portInfo);
    const [chip, ...scope] = outterScope;

    const parentChip = scope[0];
    assert(parentChip, `Port "${port.fullName}" should be an outlet`);

    const conns = info(chip).getConnectedPorts(port, chip);
    assert(conns.length <= 1, 'unimplemented multi-conns');
    const conn = conns[0];

    if (!conn) return;

    return compile(
      conn,
      conn.chip !== chip ? [conn.chip, chip, ...scope] : [conn.chip, ...scope],
      codeWrapper,
    );
  };
}

// Input data ports are always passive elements (ie: can not specify any kind
// of execution) and can be connected to take data from an output data port or
// have a `defaultValue` compiled as a literal.
function makeInputDataSinkCompiler(portInfo) {
  assert(
    portInfo.isInput && portInfo.isData,
    'Can only create compiler for input data ports',
  );

  return function forwardDataCompiler(portInstance, outterScope, codeWrapper) {
    assertInfo(portInstance, portInfo);

    if (isOutlet(portInfo, outterScope)) {
      return codeWrapper.compileInputDataOutlet(portInfo);
    }

    const [chip, ...scope] = outterScope;
    const parentChip = scope[0];

    // Variadic inputs may need resolution of ports into an array value
    if (portInfo.isVariadic) {
      const variadicValues = literalCompiler(portInstance.value);
      // TODO check that variadicValues is an array
      let index = 0;
      for (const variadicPortInstance of portInstance.variadic) {
        if (variadicPortInstance) {
          const conn = info(parentChip).getConnectedPorts(
            variadicPortInstance,
          )[0];
          if (conn) {
            const valueBlock = compile(
              conn,
              [conn.chip, ...scope],
              codeWrapper,
            );
            variadicValues.elements[index] = valueBlock;
          }
        }
        index++;
      }
      return variadicValues;
    }

    assert(
      parentChip,
      `Invalid scope while compiling port "${portInstance.name}"`,
    );

    const conns = info(parentChip).getConnectedPorts(portInstance, parentChip);
    assert(conns.length <= 1, 'Input data ports can have at most 1 connection');
    const conn = conns[0];

    if (conn) {
      if (conn.chip !== scope[0]) {
        return compile(conn, [conn.chip, ...scope], codeWrapper);
      }
      return compile(conn, scope, codeWrapper);
    }

    if (typeof portInstance.value !== 'undefined') {
      return literalCompiler(portInstance.value);
    }
  };
}

// Compile an output data port like:
//
//     const o = outputData('o', () => in1() + in2());
//     const o = outputData('o', then);
//
function makeOutputDataSourceCompiler(portInfo) {
  assert(
    portInfo.isOutput && portInfo.isData,
    'Can only create compiler for output data ports',
  );

  if (!portInfo.compute && portInfo.computeOn.length === 0) {
    // TODO nothing to do? maybe check that it is used by an exec?
    // throw new Error('unimplemented');
    return function assignOutputValueCompiler(
      portInstance,
      outterScope,
      codeWrapper,
    ) {
      // TODO get unique name from codeWrapper instead
      // (deterministic with portInstance.name and outterScope)
      return builders.identifier(portInstance.name);
    };
  }

  // This case is that of an output port connected to an input in a chip with
  // output flows:
  //
  //     ...
  //     const out = outputData('out', then);
  //     wire(inp, out);
  //
  if (portInfo.computeOn.length > 0 && !portInfo.compute) {
    return function computeOnCompiler(portInstance, outterScope, codeWrapper) {
      const [chip, ...scope] = outterScope;

      // We find the connected input
      const conn = info(chip).getConnectedPorts(
        portInstance || portInfo,
        chip,
      )[0];

      assert(conn, `Output data port "${portInfo.name}" must be connected`);

      // If connecting to an output data outlet (ie: an output port of the root
      // chip)
      if (isOutlet(portInfo, outterScope)) {
        let assignExpressionBlock;
        // The connected input data port may also be an outlet. This happens
        // when "passing through" values on the root chip directly from an input
        // to an output
        if (isOutlet(conn, outterScope)) {
          assignExpressionBlock = codeWrapper.compileInputDataOutlet(conn);
        } else {
          // Or it could be a port of a chip instance, in that case we get its
          // value to be assigned to the outptu
          assignExpressionBlock = compile(
            conn,
            conn.chip === chip
              ? [conn.chip, ...scope]
              : [conn.chip, chip, ...scope],
            codeWrapper,
          );
        }

        // Assign to an outlet (aka a non connected port of the root chip)
        return codeWrapper.compileOutputDataOutlet(
          portInfo,
          assignExpressionBlock,
        );
      } else {
        // Read an inlet (aka a computeOn port of a chip instance within
        // the root chip). Note how we use the inlet without an assignment,
        // meaning that we expect to read the inlet value.
        // This should return something like the variable name created for
        // the inlet.
        // The actual assignment is deferred to the output flow port computing
        // this output data. See forwardSourceCompiler#findSourceCompiler for
        // more.
        return codeWrapper.compileVariableInlet(portInstance);
      }
    };
  }

  // We use the output data compute function
  return function useComputeCompiler(portInstance, outterScope, codeWrapper) {
    const makeCompute = portInfo.allowSideEffects
      ? executeCompiler(portInfo, 'compute', 'computeCompiler')
      : computeCompiler(portInfo);
    const outputExpression = makeCompute(
      portInstance,
      outterScope,
      codeWrapper,
    );

    // Like in the computedOn connection case above, we assign the value if
    // the current output data port is an outlet, or we just read the inlet
    // variable name. See forwardSourceCompiler#findSourceCompiler for more.
    if (portInfo.computeOn.length > 0) {
      if (isOutlet(portInfo, outterScope)) {
        return codeWrapper.compileOutputDataOutlet(portInfo, outputExpression);
      } else {
        return codeWrapper.compileVariableInlet(portInstance);
      }
    }

    // We might want to not inline the port, that is instead of duplicating
    // the port block to all the places it's used, we create a function and
    // call that function here.
    let shouldInline = portInfo.inline;
    // Auto do-not-inline detection
    if (typeof shouldInline === 'undefined') {
      // If we have a block statement we default to not inline
      if (namedTypes.BlockStatement.check(outputExpression)) {
        shouldInline = false;
      }
      // With a literal we instead inline by default
      else if (namedTypes.Literal.check(outputExpression)) {
        shouldInline = true;
      }
      // If we have more than one connection to this output data port, we
      // prefer to not-inline its value
      else if (outterScope.length > 1) {
        const [chip, ...scope] = outterScope;
        const parentChip = scope[0];
        const connCount = info(parentChip).getConnectedPorts(portInstance)
          .length;
        shouldInline = connCount <= 1;
      } else {
        shouldInline = true;
      }
    }

    if (!shouldInline) {
      return codeWrapper.compileFunctionInlet(
        portInstance || portInfo,
        outputExpression,
      );
    }

    return outputExpression;
  };
}
