import recast from '../vendor/recast.mjs';
import { info } from './utils.mjs';
import ClassWrapper from './wrappers/ClassWrapper.mjs';
import {
  getHookPorts,
  isOutlet,
  makeChipInstanceMock,
  getPortAndChipInstance,
  getConnectedPorts,
} from './compile-helpers.mjs';
import {
  makeOutputFlowSinkCompiler,
  makeInputFlowSourceCompiler,
  makeInputDataSinkCompiler,
  makeOutputDataSourceCompiler,
} from './compile-port-compilers.mjs';

/**
 * @typedef {import('./chip.mjs').ChipInfo} ChipInfo
 * @typedef {import('./ports.mjs').Port} Port
 * @typedef {import('./ports.mjs').PortInfo} PortInfo
 * @typedef {{
 *   selectPorts: (chip: unknown) => Port[] | undefined
 * }} CompilationHook
 * @typedef {{ [label: string]: CompilationHook }} CompilationHooks
 * @typedef {unknown[]} CompilationScope
 * @typedef {(portInstance: Port, scope: CompilationScope, codeWrapper: unknown, tools?: unknown) => unknown} PortCompiler
 */

const {
  prettyPrint,
  types: { namedTypes, builders },
} = recast;

/**
 * Compiles a fully loaded chip model into wrapper-specific executable code.
 */
export class Compilation {
  /**
   * @param {ChipInfo} rootChipInfo
   * @param {unknown} rootChip
   */
  constructor(rootChipInfo, rootChip) {
    /** @type {unknown} */
    this.rootChip = rootChip;
    /** @type {ChipInfo} */
    this.rootChipInfo = rootChipInfo;
  }

  /**
   * Compiles the root chip with the provided wrapper and optional hooks.
   *
   * @param {unknown} [codeWrapper]
   * @param {CompilationHooks} [hooks]
   * @returns {string}
   */
  compile(codeWrapper, hooks) {
    if (!this.rootChipInfo.isLoaded) {
      throw new Error('Cannot compile non-fully loaded chip');
    }

    codeWrapper = codeWrapper || new ClassWrapper();

    // TODO compile each input exec ports
    const rootInfo = this.rootChipInfo;
    const rootChip = this.rootChip || makeChipInstanceMock(this.rootChipInfo);
    /** @type {CompilationScope} */
    const scope = [rootChip];
    /** @type {{ [name: string]: unknown }} */
    const outputBlocksByPort = {};
    /** @type {{ [name: string]: unknown }} */
    const executeBlocksByPort = {};
    /**
     * A map of hook label to array of compiled blocks for the hook
     *
     * @type {{ [label: string]: unknown[] }}
     */
    const hooksBlocksByLabel = {};
    /** @type {{ [name: string]: unknown[] }} */
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

  /**
   * @returns {string}
   */
  toString() {
    return this.compile();
  }
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

/**
 * Compiles a port instance in a specific chip scope.
 *
 * @param {unknown} port
 * @param {CompilationScope} scope
 * @param {unknown} codeWrapper
 * @returns {unknown}
 */
function compile(port, scope, codeWrapper) {
  const { port: resolvedPort } = getPortAndChipInstance(port, scope);
  return compiler(info(resolvedPort))(resolvedPort, scope, codeWrapper);
}

/**
 * Get the compiler for a port
 *
 * @param {PortInfo} portInfo
 * @returns {PortCompiler}
 */
function compiler(portInfo) {
  if (portInfo.compiler) return portInfo.compiler;
  const ctx = CUSTOM_COMPILER_TOOLS;
  if (portInfo.isFlow) {
    if (portInfo.isInput) {
      portInfo.compiler = makeInputFlowSourceCompiler(portInfo, ctx);
    } else {
      portInfo.compiler = makeOutputFlowSinkCompiler(portInfo, ctx);
    }
  } else {
    if (portInfo.isInput) {
      portInfo.compiler = makeInputDataSinkCompiler(portInfo, ctx);
    } else {
      portInfo.compiler = makeOutputDataSourceCompiler(portInfo, ctx);
    }
  }
  return portInfo.compiler;
}
