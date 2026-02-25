// @ts-check
import { context, assert, info } from "./utils.mjs";
import { Chip as ChipBase, ChipInfo } from "./chip.mjs";
import { runFlowPorts } from "./run.mjs";
import { Compilation } from "./compile.mjs";
import { ExternalReference } from "./external.mjs";

/**
 * @typedef {{ name: string, type?: string }} EventPortDescriptor
 * @typedef {{ selectPorts?: (chip: unknown) => unknown[] | undefined }} ChipHookSelector
 * @typedef {{ onCreate?: ChipHookSelector, onDestroy?: ChipHookSelector }} ChipHooks
 * @typedef {{ [name: string]: typeof ChipBase }} ChipCustomClasses
 * @typedef {{
 *   editable?: boolean,
 *   metadata?: unknown,
 *   label?: string | ((chipInstance?: import('./chip.mjs').Chip) => string),
 *   imports?: Record<string, string>
 * }} ChipConfiguration
 * @typedef {(uri?: string | Function, build?: Function | ChipConfiguration, configuration?: ChipConfiguration) => typeof ChipBase} ChipFactory
 */

// Creates a chip
export const plainChip = makeChipFactory();

const OnCreate = event("OnCreate");
const OnDestroy = event("OnDestroy");

// Creates a chip with OnCreate and OnDestroy provided custom chips
export const chip = makeChipFactory(
  () => {
    return { OnCreate, OnDestroy };
  },
  {
    onCreate: {
      /**
       * @param {unknown} chip
       * @returns {unknown[] | undefined}
       */
      selectPorts(chip) {
        if (chip instanceof OnCreate) {
          const thenPort = /** @type {{ out?: { then?: unknown } }} */ (chip)
            .out?.then;
          if (thenPort) return [thenPort];
        }
      },
    },
    onDestroy: {
      /**
       * @param {unknown} chip
       * @returns {unknown[] | undefined}
       */
      selectPorts(chip) {
        if (chip instanceof OnDestroy) {
          const thenPort = /** @type {{ out?: { then?: unknown } }} */ (chip)
            .out?.then;
          if (thenPort) return [thenPort];
        }
      },
    },
  }
);

/**
 * Adds an input flow outlet to the chip currently in build context.
 *
 * @param {string} name
 * @param {object | Function} [config]
 * @returns {import('./ports.mjs').PortOutlet}
 */
export function inputFlow(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addInputFlowPort(name, config);
}

/**
 * @param {string} name
 * @param {object | boolean | string} [config]
 * @returns {import('./ports.mjs').PortOutlet}
 */
export function inputData(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addInputDataPort(name, config);
}

/**
 * @param {string} name
 * @param {object} [config]
 * @returns {import('./ports.mjs').PortOutlet}
 */
export function outputFlow(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addOutputFlowPort(name, config);
}

/**
 * @param {string} name
 * @param {object | Function | string | any[]} [config]
 * @returns {import('./ports.mjs').PortOutlet}
 */
export function outputData(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addOutputDataPort(name, config);
}

/**
 * Wires two ports in the current chip build context.
 *
 * @param {import('./chip.mjs').ConnectionEndpointSelector} portA
 * @param {import('./chip.mjs').ConnectionEndpointSelector} portB
 */
export function wire(portA, portB) {
  const chipInfo = context(ChipInfo);
  chipInfo.addConnection(portA, portB);
}

/**
 * @param {string} name
 * @param {{ defaultValue?: unknown, required?: boolean }} [config]
 */
export function inputConfig(name, { defaultValue, required } = {}) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addInputDataPort(name, {
    canonical: required ? "required" : true,
    concealed: true,
    defaultValue,
  });
}

/**
 * Creates an output data handle port that exposes a callable value.
 *
 * @param {string} name
 * @param {Function} execHandle
 * @param {string} [type]
 * @returns {import('./ports.mjs').PortOutlet}
 */
export function outputHandle(name, execHandle, type) {
  assert(
    typeof execHandle === "function",
    "A handler should specify a function"
  );
  const compute = () => execHandle;
  compute.toString = () => "() => " + String(execHandle);
  const handlePort = outputData(name, {
    compute,
    inline: "once",
    allowSideEffects: true,
    type,
  });
  Object.defineProperty(handlePort, "isHandle", {
    enumerable: true,
    value: true,
  });
  return handlePort;
}

/**
 * Creates an event chip class exposing `handle` and `then` plus custom outputs.
 *
 * @param {string} name
 * @param {...(string | EventPortDescriptor)} ports
 * @returns {typeof ChipBase}
 */
export function event(name, ...ports) {
  /** @type {EventPortDescriptor[]} */
  const normalizedPorts = (ports || []).map((p) => {
    if (typeof p === "string") {
      const [portName, portType] = p.split(":");
      return { name: portName, type: portType || "any" };
    }
    return p;
  });
  const handleArgs = normalizedPorts
    .map(({ name, type }) => `${name}:${type || "any"}`)
    .join(", ");
  const handleType = `(${handleArgs}) => void`;
  const EventChip = plainChip(name, () => {
    /** @param {...unknown} args */
    const handler = (...args) => {
      for (let i = 0, l = outputs.length; i < l; i++) {
        outputs[i](args[i]);
      }
      then();
    };
    handler.toString = () => `(...args) => {
      ${normalizedPorts.map(({ name }, i) => `${name}(args[${i}]);`).join("\n")}
      then();
    }`;
    const handle = outputHandle("handle", handler, handleType);
    const then = outputFlow("then");
    const outputs = normalizedPorts.map(({ name, type }) =>
      outputData(name, { type })
    );
  });
  Object.defineProperties(EventChip.prototype, {
    customChipKind: {
      enumerable: true,
      value: "event",
    },
    chipURI: {
      enumerable: true,
      value:
        normalizedPorts.length === 0
          ? `${name}:event`
          : `${name}:event(${handleArgs})`,
    },
  });
  return EventChip;
}

/**
 * @param {string} name
 * @param {string} [type]
 * @returns {typeof ChipBase}
 */
export function switchChip(name, type = "any") {
  const SwitchChip = plainChip(name, () => {
    const exec = inputFlow("exec", {
      execute: () => {
        const allCases = cases();
        const allCasesCont = thens();
        const sel = discriminant();
        for (let i = 0, l = allCases.length; i < l; i++) {
          const caseValue = allCases[i];
          if (caseValue === sel) {
            allCasesCont[i]();
            return;
          }
        }
        thenDefault();
      },
      /**
       * @param {unknown} port
       * @param {unknown} scope
       * @param {unknown} codeWrapper
       * @param {{
       *   compile: Function,
       *   getPortAndChipInstance: Function,
       *   recast: {
       *     types: {
       *       namedTypes: { Statement: { check: Function } },
       *       builders: {
       *         expressionStatement: Function,
       *         switchCase: Function,
       *         breakStatement: Function,
       *         switchStatement: Function
       *       }
       *     }
       *   }
       * }} tools
       * @returns {unknown}
       */
      executeCompiler: (port, scope, codeWrapper, tools) => {
        const disc = tools.compile(discriminant, scope, codeWrapper, tools);
        if (!disc) return;
        const switchCases = [];
        const { port: casesPort } = tools.getPortAndChipInstance(cases, scope);
        const { port: thensPort } = tools.getPortAndChipInstance(thens, scope);
        for (let i = 0, l = casesPort.variadic.length; i < l; i++) {
          const casePort = casesPort.variadic[i];
          const thenPort = thensPort.variadic[i];
          const caseDiscr = tools.compile(casePort, scope, codeWrapper, tools);
          let caseBlock = tools.compile(thenPort, scope, codeWrapper, tools);
          if (!tools.recast.types.namedTypes.Statement.check(caseBlock)) {
            caseBlock =
              tools.recast.types.builders.expressionStatement(caseBlock);
          }
          switchCases.push(
            tools.recast.types.builders.switchCase(caseDiscr, [
              caseBlock,
              tools.recast.types.builders.breakStatement(),
            ])
          );
        }
        let defaultCaseBlock = tools.compile(
          thenDefault,
          scope,
          codeWrapper,
          tools
        );
        if (!tools.recast.types.namedTypes.Statement.check(defaultCaseBlock)) {
          defaultCaseBlock =
            tools.recast.types.builders.expressionStatement(defaultCaseBlock);
        }
        if (defaultCaseBlock) {
          switchCases.push(
            tools.recast.types.builders.switchCase(null, [
              defaultCaseBlock,
              tools.recast.types.builders.breakStatement(),
            ])
          );
        }
        if (switchCases.length === 0) return;
        return tools.recast.types.builders.switchStatement(disc, switchCases);
      },
    });
    const discriminant = inputData("discriminant", { canonical: true, type });
    const cases = inputData("cases", {
      type: `[${type}]`,
      variadic: "case{index}",
    });
    const thenDefault = outputFlow("thenDefault");
    const thens = outputFlow("thens", { variadic: "then{index}" });
  });
  Object.defineProperties(SwitchChip.prototype, {
    customChipKind: {
      enumerable: true,
      value: "switch",
    },
    chipURI: {
      enumerable: true,
      value: `${name}:switch(${type})`,
    },
  });
  return SwitchChip;
}

/**
 * NOTE externalReferenceObj must be specified as `{ myReference }` so that
 * the engine can extract both a compiletime name and a runtime reference.
 * If the name is not somehow provided to the compiled code (ie: by adding a
 * value to `window.myReference`), the compiled code will fail to execute.
 *
 * @param {object} externalReferenceObj
 * @returns {ExternalReference}
 */
export function externalRef(externalReferenceObj) {
  return new ExternalReference(externalReferenceObj);
}

const ExternalGetInt = plainChip("ExternalGet", () => {
  const externalDataRef = inputData("externalDataRef", {
    canonical: "required",
    concealed: "hidden",
  });
  outputData("value", () => externalDataRef());
});

/**
 * @param {string | object} externalReferenceObj
 * @returns {typeof ExternalGetInt}
 */
export function externalGet(externalReferenceObj) {
  if (typeof externalReferenceObj === "string") {
    externalReferenceObj = {
      [externalReferenceObj]: undefined,
    };
  }
  /** @type {object} */
  const normalizedExternalRef = /** @type {object} */ (externalReferenceObj);
  return class ExternalGet extends ExternalGetInt {
    constructor() {
      super(externalRef(normalizedExternalRef));
    }
  };
}

const ExternalSetInt = plainChip("ExternalSet", () => {
  const exec = inputFlow("exec", () => {
    externalSetRef()(value());
    then();
  });
  const externalSetRef = inputData("externalSetRef", {
    canonical: "required",
    concealed: "hidden",
  });
  const value = inputData("value", {
    canonical: true,
  });
  const then = outputFlow("then");
  const outValue = outputData("value");
  wire(value, outValue);
});

/**
 * @param {object} externalReferenceObj
 * @returns {typeof ExternalSetInt}
 */
export function externalSet(externalReferenceObj) {
  return class ExternalSet extends ExternalSetInt {
    /** @param {...unknown} args */
    constructor(...args) {
      super(externalRef(externalReferenceObj), .../** @type {any[]} */ (args));
    }
  };
}

//
// Implementations
//

/**
 * Creates a chip-class factory with optional custom chips and lifecycle hooks.
 *
 * @param {((config?: ChipConfiguration) => ChipCustomClasses) | ChipCustomClasses} [$customChips]
 * @param {ChipHooks} [$hooks]
 * @returns {ChipFactory & { extend: (customChips: ChipCustomClasses | (() => ChipCustomClasses), hooks?: ChipHooks) => ChipFactory }}
 */
function makeChipFactory($customChips, $hooks) {
  /**
   * @param {string | Function} [uri]
   * @param {Function | ChipConfiguration} [build]
   * @param {ChipConfiguration} [configuration]
   * @returns {typeof ChipBase}
   */
  function chip(uri, build, configuration) {
    /** @type {string | undefined} */
    let chipURI = typeof uri === "string" ? uri : undefined;
    if (typeof uri !== "string") {
      build = uri;
      chipURI = undefined;
    }
    const config = Object.assign(
      {
        editable: true,
        metadata: undefined,
      },
      configuration
    );
    const chipInfo = new ChipInfo(chipURI, config.label);
    context.push(chipInfo);
    /** @type {ChipCustomClasses} */
    let customChips = {};
    try {
      const resolvedCustomChips =
        (typeof $customChips === "function"
          ? $customChips(config)
          : $customChips) || {};
      customChips = resolvedCustomChips;
      if (typeof build === "function") {
        build.call(undefined, customChips);
      }
    } catch (buildError) {
      context.pop();
      throw buildError;
    }
    context.pop();
    // TODO validate chip:
    // - if input data but not flow it may not do what you expect
    // - if not using all input data in outputs/execs
    class Chip extends ChipBase {
      /** @param {...unknown} canonicalValues */
      constructor(...canonicalValues) {
        super(chipInfo, /** @type {any[]} */ (canonicalValues));
        const parentChipInfo = context();
        // Add to current chip `build` execution
        if (parentChipInfo instanceof ChipInfo) {
          parentChipInfo.addChip(this);
        }
        // Run `onCreate` hooks
        else if (
          $hooks &&
          $hooks.onCreate &&
          typeof $hooks.onCreate.selectPorts === "function"
        ) {
          runFlowPorts(this, $hooks.onCreate.selectPorts);
        }
      }

      destroy() {
        if (
          $hooks &&
          $hooks.onDestroy &&
          typeof $hooks.onDestroy.selectPorts === "function"
        ) {
          runFlowPorts(this, $hooks.onDestroy.selectPorts);
        }
      }

      /**
       * @param {unknown} [wrapper]
       * @returns {string}
       */
      compile(wrapper) {
        const compilation = new Compilation(chipInfo, this);
        return compilation.compile(wrapper, $hooks);
      }

      //
      // Static public API
      //

      static get URI() {
        return chipInfo.URI;
      }

      static get label() {
        return chipInfo.makeChipLabel();
      }

      static get imports() {
        return Object.assign(
          {},
          config.imports,
          ...chipInfo.chips.map(
            (c) =>
              /** @type {{ imports?: Record<string, string> }} */ (
                c.constructor
              ).imports
          )
        );
      }

      /**
       * @param {unknown} [wrapper]
       * @returns {string}
       */
      static compile(wrapper) {
        const compilation = new Compilation(chipInfo, null);
        return compilation.compile(wrapper, $hooks);
      }

      /**
       * @param {Record<string, unknown>} [context]
       * @param {(url: string) => unknown | Promise<unknown>} [importModule]
       * @returns {Promise<unknown>}
       */
      static async compiledClass(context, importModule) {
        const imports = Object.entries(this.imports);
        const importsNames = imports.map(([name]) => name);
        const importsValues = imports.map(([, url]) =>
          (importModule
            ? Promise.resolve(importModule(url))
            : import(/* @vite-ignore */ url).catch((e) => {
                console.warn("Could not import: ", url);
                return Promise.reject(e);
              })
          ).then((m) => m.default || m)
        );
        const ctx = Object.entries(context || {}).filter(
          ([name]) => !importsNames.includes(name)
        );
        const ctxNames = ctx.map(([name]) => name);
        const ctxValues = ctx.map(([, val]) => val);
        const code = this.compile();
        const makeCompiledClass = new Function(
          ...importsNames,
          ...ctxNames,
          "return (" + code + ")"
        );
        return makeCompiledClass(
          ...(await Promise.all(importsValues)),
          ...(await Promise.all(ctxValues))
        );
      }

      /**
       * @param {import('./registry.mjs').Registry} [registry]
       * @returns {Record<string, unknown>}
       */
      static toJSON(registry) {
        const chipData = chipInfo.toJSON(registry);
        if (!this.editable) {
          chipData.editable = false;
        }
        if (this.metadata) {
          // TODO clone-deep
          chipData.metadata = this.metadata;
        }
        return chipData;
      }

      static get metadata() {
        return config.metadata;
      }

      static set metadata(value) {
        config.metadata = value;
      }

      static get editable() {
        return config.editable;
      }

      static get isLoaded() {
        return chipInfo.isLoaded;
      }

      static get loaded() {
        return chipInfo.loaded;
      }

      static get uses() {
        return (chipInfo.registry && chipInfo.registry.useList) || [];
      }

      static get inputOutlets() {
        return chipInfo.inputs.slice();
      }

      static get outputOutlets() {
        return chipInfo.outputs.slice();
      }

      static get chips() {
        return chipInfo.chips.slice();
      }

      static get customChipClasses() {
        return customChips;
      }

      static get connections() {
        return Array.from(chipInfo.sinkConnection.entries()).map(
          ([sinkPort, sourcePort]) => {
            let source = { chip: sourcePort.chip, port: sourcePort };
            let sink = { chip: sinkPort.chip, port: sinkPort };
            // If one of the ports is a flow outlet we need to invert the logic
            if (sinkPort.isFlow || (info(sinkPort) && info(sinkPort).isFlow)) {
              const tmp = source;
              source = sink;
              sink = tmp;
            }
            return {
              source,
              sink,
            };
          }
        );
      }
    }

    info(Chip, chipInfo);

    return Chip;
  }
  /**
   * @param {ChipCustomClasses | (() => ChipCustomClasses)} customChips
   * @param {ChipHooks} [hooks]
   * @returns {ChipFactory}
   */
  chip.extend = function extendChip(customChips, hooks) {
    return makeChipFactory(
      (config) =>
        Object.assign(
          {},
          (typeof $customChips === "function"
            ? $customChips(config)
            : $customChips) || {},
          (typeof customChips === "function" && customChips()) || customChips
        ),
      Object.assign({}, $hooks, hooks)
    );
  };
  return chip;
}
