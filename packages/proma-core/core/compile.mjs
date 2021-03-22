import recast from '../vendor/recast.mjs';
import { info, context, assert, assertInfo } from './utils.mjs';
import ClassWrapper from './wrappers/ClassWrapper.mjs';
import { literalCompiler, makeAstBuilder } from './compile-utils.mjs';
import { INPUT, OUTPUT } from './ports.mjs';

const {
  prettyPrint,
  types: { namedTypes, builders },
} = recast;

export class Compilation {
  constructor(rootChipInfo, rootChip) {
    this.rootChip = rootChip;
    this.rootChipInfo = rootChipInfo;
  }

  compile(codeWrapper, hooks) {
    codeWrapper = codeWrapper || new ClassWrapper();

    // TODO compile each input exec ports
    const rootInfo = this.rootChipInfo;
    const rootChip = this.rootChip || makeChipInstanceMock(this.rootChipInfo);
    const scope = [rootChip];
    const outputBlocksByPort = {};
    const executeBlocksByPort = {};
    // A map of hook label to array of compiled blocks for the hook
    const hooksBlocksByLabel = {};
    const updateBlocksByPort = {};

    if (codeWrapper.compileBegin) {
      codeWrapper.compileBegin(this.rootChip, this.rootChipInfo);
    }

    if (rootInfo.isFlowless) {
      // "Pure" chips

      // Outputs

      for (const portOutlet of rootInfo.outputDataPorts) {
        const portInfo = info(portOutlet);
        const block = compiler(portInfo)(portOutlet, scope, codeWrapper);
        outputBlocksByPort[portInfo.name] = block;
      }
    } else {
      // Chips with flow

      // It is important that executions and hooks are compiled before
      // outputFlows that may have `computeOutputs` for outputs that are
      // actually pushed in and execute.
      // If that't the case, output data portInfo will have their `$isPushing`
      // set to `true` and can be ignored by the computeOn.

      // Executions

      for (const portOutlet of rootInfo.inputFlowPorts) {
        const portInfo = info(portOutlet);
        const block = compiler(portInfo)(portOutlet, scope, codeWrapper);
        executeBlocksByPort[portInfo.name] = block;
      }

      // Hooks
      // These are (if defined) an object with the key being the label of the
      // hook and the value an object with:
      // - `selectPorts` a required function that will be run recursivelly on
      //   all inner chips and should return an array of ports to be compiled
      //   for that chip (or nothing to ignore the chip)
      //
      //     {
      //       hookLabel: {
      //         selectPorts: chip => [chip.out.flow]
      //       }
      //     }
      //
      // Note that the wrapper will need to know what to do with these.

      for (const [label, { selectPorts }] of Object.entries(hooks || {})) {
        const hookPorts = getHookPorts(rootChip, selectPorts);
        const hookBlocks = [];
        for (const { port, scope } of hookPorts) {
          let block = compile(port, scope, codeWrapper);
          if (!block) continue;
          if (namedTypes.ArrowFunctionExpression.check(block)) {
            // This is (probably?) an `async () => { ... }` that we want to call
            block = builders.expressionStatement(
              builders.callExpression(block, []),
            );
          } else if (!namedTypes.BlockStatement.check(block)) {
            if (!namedTypes.ExpressionStatement.check(block)) {
              block = builders.expressionStatement(block);
            }
            block = builders.blockStatement([block]);
          }
          hookBlocks.push(block);
        }
        hooksBlocksByLabel[label] = hookBlocks;
      }

      // Output data with compute but no computeOn will be initialized once
      // This covers stuff like handlers
      for (const portOutlet of rootInfo.outputDataPorts) {
        const portInfo = info(portOutlet);
        if (portInfo.compute && portInfo.computeOn.length === 0) {
          const block = compiler(portInfo)(portOutlet, scope, codeWrapper);
          outputBlocksByPort[portInfo.name] = block;
        }
      }

      // Output flows

      for (const portOutlet of rootInfo.outputFlowPorts) {
        const portInfo = info(portOutlet);
        if (portInfo.computeOutputs.size === 0) continue;

        updateBlocksByPort[portInfo.name] = Array.from(portInfo.computeOutputs)
          // If the output data port is being pushed by and exec, we ignore
          // the fact that it should be computed here
          .filter((outPortInfo) => !outPortInfo.$isPushing)
          .map((outPortInfo) => {
            return compiler(outPortInfo)(
              rootInfo.getOutputPortOutlet(outPortInfo.name),
              scope,
              codeWrapper,
            );
          });
      }
    }

    // Build the final program
    const program = codeWrapper.compileEnd({
      chip: this.rootChip,
      chipInfo: this.rootChipInfo,
      compiledHooks: hooksBlocksByLabel,
      compiledFlowPorts: executeBlocksByPort,
      compiledOutputPorts: outputBlocksByPort,
      compiledUpdatesOnPorts: updateBlocksByPort,
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

function getHookPorts(chip, selectPorts, scope) {
  if (!scope) {
    scope = [chip];
  }
  const hookPorts = [];
  const chipInfo = info(chip);
  for (const subChip of chipInfo.chips) {
    const selectedPorts = selectPorts(subChip);
    if (!selectedPorts || selectedPorts.length === 0) {
      continue;
    }
    const newScope = [subChip, ...scope];
    for (const port of selectedPorts) {
      if (!port.isOutput || !port.isFlow) {
        throw new Error(
          `Can only select output flow ports as hooks. Got "${port.fullName}"`,
        );
      }
      hookPorts.push({
        port,
        scope: newScope,
      });
    }
  }
  for (const subChip of chipInfo.chips) {
    hookPorts.push(...getHookPorts(subChip, selectPorts, [subChip, ...scope]));
  }
  return hookPorts;
}

function isOutlet(port, scope) {
  const rootInfo = info(scope[scope.length - 1]);
  return rootInfo === info(port).chipInfo;
}

function makeChipInstanceMock(chipInfo) {
  const input = chipInfo.inputs.reduce((acc, outlet) => {
    acc[outlet.name] = outlet;
    return acc;
  }, {});
  const output = chipInfo.outputs.reduce((acc, outlet) => {
    acc[outlet.name] = outlet;
    return acc;
  }, {});

  return info(
    {
      isMock: true,
      [INPUT]: input,
      [OUTPUT]: output,
    },
    chipInfo,
  );
}

// When using `compile` from a custom compilation function, we allow users
// to use the local outlet to refer to the chip instance port.
function getPortAndChipInstance(port, scope) {
  const [chip, parentChip] = scope;
  if (port.isOutlet && !isOutlet(port, scope)) {
    port = chip[port.isInput ? INPUT : OUTPUT][port.name];
  }
  return { port, chip, parentChip };
}

function getConnectedPorts(port, scope) {
  const { port: resolvedPort, parentChip } = getPortAndChipInstance(
    port,
    scope,
  );
  return info(parentChip).getConnectedPorts(resolvedPort, parentChip);
}

//
// Compilers
//

// A series of tools that should be sent to custom compilers (ie: executeCompiler)
const CUSTOM_COMPILER_TOOLS = {
  compile,
  recast,
  getPortAndChipInstance,
  isOutlet,
  getConnectedPorts,
};

function compile(port, scope, codeWrapper) {
  const { port: resolvedPort } = getPortAndChipInstance(port, scope);
  return compiler(info(resolvedPort))(resolvedPort, scope, codeWrapper);
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
        return compile(port, [chip, ...scope], codeWrapper);
      },
      /**
       * Output data in executes are used like so:
       *     portName(assignExpressionBlock);
       * But it can also be used to read the output port value:
       *     portName(portName() + 1);
       * The provided `assignExpressionBlock` is the expression to assign to the
       * output port if present.
       * This function should always return a `blockStatement` and the last
       * expression of the block should always be something to read the value
       * of the output.
       */
      compileOutputData(portName, assignExpressionBlock) {
        const port = chip.out[portName];
        const portInfo = info(port);

        if (isOutlet(port, outterScope)) {
          const body = [];
          if (typeof assignExpressionBlock !== 'undefined') {
            body.push(
              builders.expressionStatement(
                codeWrapper.compileOutputDataOutlet(
                  port,
                  assignExpressionBlock,
                ),
              ),
            );
          }
          body.push(
            builders.expressionStatement(
              codeWrapper.compileOutputDataOutlet(port),
            ),
          );
          return builders.blockStatement(body);
        }

        assert(
          portInfo.computeOn.length === 0,
          `Can not assign to "${
            port.fullName
          }" as it is computed on [${portInfo.computeOn
            .map((p) => p.name)
            .join(', ')}]`,
        );

        // An exectute is pushing data to this output port. This is used in
        // `computeOnCompiler` to ignore `computeOn` stuff as the port value
        // will be manually assigned here
        portInfo.$isPushing = true;

        // Collect declarations needed to satisfy this output
        const declarations = [];

        // If the output port is not used for assigning a value ornot inlining,
        // we create an inlet for the variable to be returned as the last
        // declaration. The ast compiler will know how to extract it.
        //
        //   if(myOutput()) { ... }
        //
        let appendDeclarationInletForRead =
          typeof assignExpressionBlock === 'undefined' ||
          portInfo.inline === false ||
          portInfo.inline === 'once';

        if (appendDeclarationInletForRead) {
          if (typeof assignExpressionBlock === 'undefined') {
            assignExpressionBlock = codeWrapper.compileVariableInlet(
              port,
              literalCompiler(port.defaultValue),
              portInfo.inline === 'once' ? 'const' : 'init',
            );
          } else {
            declarations.push(
              builders.expressionStatement(
                codeWrapper.compileVariableInlet(port, assignExpressionBlock),
              ),
            );
            assignExpressionBlock = codeWrapper.compileVariableInlet(port);
          }

          // Transform `appendDeclarationInletForRead` to the actual identifier
          // to use as reference for the inlet
          appendDeclarationInletForRead = assignExpressionBlock;
        }

        // Generate assignment of local variable
        //    let portName = <assignExpressionBlock>;
        // Or if the connection is an outlet, assign to it.

        const parentChip = scope[0];
        assert(parentChip, `Port "${port.fullName}" should be an outlet`);

        const conns = info(parentChip).getConnectedPorts(port, parentChip);

        for (const conn of conns) {
          if (conn) {
            let outputIdentifier;
            // conn.chip might be undefined if compiling an outlet
            if (conn.chip && conn.chip !== scope[0]) {
              outputIdentifier = compile(
                conn,
                [conn.chip, ...scope],
                codeWrapper,
              );
            } else {
              outputIdentifier = compile(conn, scope, codeWrapper);
            }

            // Assign to whatever the outlet/inlet is
            const decl = builders.expressionStatement(
              builders.assignmentExpression(
                '=',
                outputIdentifier,
                assignExpressionBlock,
              ),
            );

            declarations.push(decl);
          }
        }

        // We always want to return a block where the last expression is
        // a way to ready the output (if neccessary)
        if (appendDeclarationInletForRead) {
          declarations.push(
            builders.expressionStatement(appendDeclarationInletForRead),
          );
        } else {
          declarations.push(builders.noop());
        }
        return builders.blockStatement(declarations);
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
  return function findSourceCompiler(portInstance, outterScope, codeWrapper) {
    const [chip, ...scope] = outterScope;

    assertInfo(portInstance, portInfo);
    assertInfo(chip, portInfo.chipInfo);

    // When compiling an outlet, we just defer to the wrapper. This should
    // generate an execution of the output flow outlet in some fashon.
    if (isOutlet(portInstance, outterScope)) {
      return codeWrapper.compileOutputFlowOutlet(portInstance);
    }

    const parentChip = scope[0];
    assert(parentChip, `Port "${portInstance.fullName}" should be an outlet`);

    // Special case for variadic output flow inlets.
    // First we check if the public port has variadic instances. That is, we do
    // not check if `portInfo.isVariadic` as that `portInfo` is going to be
    // the same for variadic instances; those should not be considered variadic
    // themeself though.
    // We then compile all variadic instances
    if (portInstance.variadic) {
      const variadicFuncIdents = [];
      for (const vPort of portInstance.variadic) {
        // These will return function calls (see below where we check for
        // `portInfo.isVariadic`). We assert for that and extract the function
        // identifier.
        let vFuncIdent = compile(vPort, [chip, ...scope], codeWrapper);
        namedTypes.CallExpression.assert(vFuncIdent);
        vFuncIdent = vFuncIdent.callee;
        variadicFuncIdents.push(vFuncIdent);
      }
      // TODO store this into a `const`?
      return builders.arrayExpression(variadicFuncIdents);
    }

    const conns = info(parentChip).getConnectedPorts(portInstance, parentChip);
    assert(conns.length <= 1, 'An output flow can only have one connection');
    const conn = conns[0];

    // Continue this output chain by compiling the connected input flow if
    // present.
    let continuation;
    if (conn) {
      continuation = compile(
        conn,
        // conn.chip might be undefined if compiling an outlet
        conn.chip && conn.chip !== scope[0] ? [conn.chip, ...scope] : scope,
        codeWrapper,
      );
    }

    // All right, now we have inlets. This is an output flow that is used
    // by output data to update itself. So when this port is executed
    // we want to update those inlets with the value.
    if (portInfo.computeOutputs.size > 0) {
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
            CUSTOM_COMPILER_TOOLS,
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
      continuation = builders.blockStatement(continuationSequence);
    }

    // We have our continuation code but there is one last thing. If the port is
    // a variadic instance (but not the variadic port itself as that is handled
    // above by checking for `portInstance.variadic`) we want to return the
    // continuation as a function call.
    // This is because a variadic port instance could be used directly or in
    // an array of all other variadic instances. We then want to always return
    // a function even if there is no continuation.
    // TODO optimize to only do this if neccessary (ie: if the variadic port
    // instance continuation is used in multiple places or in the variadic array)
    if (portInfo.isVariadic) {
      if (!continuation) {
        // We default to an empty continuation because we always want to return
        // a valid function as it's probably used as one. An empty continuation
        // may happen if there are 3 variadic ports but the middle one is not
        // connected.
        continuation = builders.blockStatement([]);
      }
      return codeWrapper.compileFunctionInlet(portInstance, continuation);
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
    return function useExecuteCompiler(portInstance, outterScope, codeWrapper) {
      const executeExpression = executeCompiler(portInfo)(
        portInstance,
        outterScope,
        codeWrapper,
        CUSTOM_COMPILER_TOOLS,
      );

      // If this port is connected multiple times, we want this
      // as a function and call to that function instead (inlet)
      if (!isOutlet(portInstance, outterScope)) {
        const [chip, ...scope] = outterScope;
        const parentChip = scope[0];
        const connCount = info(parentChip).getConnectedPorts(portInstance)
          .length;
        if (connCount > 1) {
          return codeWrapper.compileFunctionInlet(
            portInstance,
            executeExpression,
          );
        }
      }

      return executeExpression;
    };
  }

  // An input flow without an execute could be a forwarding outlet.
  // We follow that to the next connection or generate a noop if there is
  // no connection.
  return function forwardSourceCompiler(
    portInstance,
    outterScope,
    codeWrapper,
  ) {
    // Special cases for outlet compilation
    // TODO perhaps cleanup
    if (isOutlet(portInstance, outterScope)) {
      const rootChip = outterScope[0];
      const conns = info(rootChip).getConnectedPorts(portInfo, rootChip);
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

    assertInfo(portInstance, portInfo);
    const [chip, ...scope] = outterScope;

    const parentChip = scope[0];
    assert(parentChip, `Port "${portInstance.fullName}" should be an outlet`);

    const conns = info(chip).getConnectedPorts(portInstance, chip);
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

    if (isOutlet(portInstance, outterScope)) {
      return codeWrapper.compileInputDataOutlet(portInstance);
    }

    const [chip, ...scope] = outterScope;
    const parentChip = scope[0];

    // Variadic inputs may need resolution of ports into an array value
    if (portInstance.variadic) {
      const variadicValues = literalCompiler(portInstance.value);
      // TODO check that variadicValues is an array
      let index = 0;
      for (const variadicPortInstance of portInstance.variadic) {
        if (variadicPortInstance) {
          const conn = info(parentChip).getConnectedPorts(
            variadicPortInstance,
            parentChip,
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

  // Reset any $isPushing set in other compilations
  portInfo.$isPushing = false;

  if (!portInfo.compute && portInfo.computeOn.length === 0) {
    // TODO nothing to do? maybe check that it is used by an exec?
    return function assignOutputValueCompiler(
      portInstance,
      outterScope,
      codeWrapper,
    ) {
      return codeWrapper.compileVariableInlet(portInstance);
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
      const conn = info(chip).getConnectedPorts(portInstance, chip)[0];

      assert(conn, `Output data port "${portInfo.name}" must be connected`);

      // If the connected port is an output data port being pushed by and
      // input flow execution, it will have this flag `$isPushing` set to true.
      // In this case the port should ignore the computeOn and act as an
      // `assignOutputValueCompiler` but returning the ouput outlet reference
      // this port would have computeOn.
      // The `$isPushing` is also stored in this port to avoid compile it as
      // an outlet `OutputFlowPort.computeOutputs`.
      if (info(conn).$isPushing) {
        portInfo.$isPushing = true;
        return codeWrapper.compileOutputDataOutlet(portInstance);
      }

      // If connecting to an output data outlet (ie: an output port of the root
      // chip)
      if (isOutlet(portInstance, outterScope)) {
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
          portInstance,
          assignExpressionBlock,
        );
      }

      // Read an inlet (aka a computeOn port of a chip instance within
      // the root chip). Note how we use the inlet without an assignment,
      // meaning that we expect to read the inlet value.
      // This should return something like the variable name created for
      // the inlet.
      // The actual assignment is deferred to the output flow port computing
      // this output data. See forwardSourceCompiler#findSourceCompiler for
      // more.
      return codeWrapper.compileVariableInlet(portInstance);
    };
  }

  // We use the output data compute function
  return function useComputeCompiler(portInstance, outterScope, codeWrapper) {
    assert(
      !portInfo.$isPushing,
      `Can not push a value to a computed output: ${portInstance.fullName}`,
    );

    const makeCompute = portInfo.allowSideEffects
      ? executeCompiler(portInfo, 'compute', 'computeCompiler')
      : computeCompiler(portInfo);
    const outputExpression = makeCompute(
      portInstance,
      outterScope,
      codeWrapper,
      CUSTOM_COMPILER_TOOLS,
    );

    // Like in the computedOn connection case above, we assign the value if
    // the current output data port is an outlet, or we just read the inlet
    // variable name. See forwardSourceCompiler#findSourceCompiler for more.
    if (portInfo.computeOn.length > 0) {
      if (isOutlet(portInstance, outterScope)) {
        return codeWrapper.compileOutputDataOutlet(
          portInstance,
          outputExpression,
        );
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

    if (shouldInline === 'once') {
      return codeWrapper.compileVariableInlet(
        portInstance,
        outputExpression,
        'const',
      );
    } else if (shouldInline === false) {
      return codeWrapper.compileFunctionInlet(portInstance, outputExpression);
    }

    return outputExpression;
  };
}
