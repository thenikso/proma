// @ts-check
import { info } from './utils.mjs';
import { variadicStringNameToFunc } from './variadic.mjs';
import { makePortRun } from './run.mjs';
import { serializePortInfo } from './serialize.mjs';
import { type } from './types.mjs';
import { INPUT, OUTPUT } from './constants.mjs';

/**
 * @typedef {{ signature?: string }} PortTypeLike
 * @typedef {{
 *   inputs: PortOutlet[],
 *   outputs: PortOutlet[]
 * }} ChipInfoLike
 */

/**
 * Runtime shape injected into callable `Port` and `PortOutlet` instances.
 * These members are defined through `Object.defineProperties` on top of the
 * function returned by `makePortRun`.
 *
 * @typedef {object} PortRuntimeShape
 * @property {any} chip
 * @property {unknown} explicitValue
 * @property {unknown} defaultValue
 * @property {boolean} isInput
 * @property {boolean} isOutput
 * @property {boolean} isFlow
 * @property {boolean} isData
 * @property {string} name
 * @property {string} fullName
 * @property {PortTypeLike | undefined} type
 * @property {boolean} isConcealed
 * @property {boolean} isCanonical
 * @property {boolean} isRequired
 * @property {boolean} isHidden
 * @property {PortVariadicAccessors | undefined} variadic
 */

/**
 * Proxy-backed list for variadic ports.
 *
 * @typedef {(Array<Port | undefined> & {[name: string]: Port | undefined})} PortVariadicAccessors
 */

/**
 * @typedef {{
 *   execute?: Function,
 *   executeCompiler?: Function
 * }} InputFlowConfig
 *
 * @typedef {{
 *   compute?: Function,
 *   computeCompiler?: Function,
 *   inline?: boolean | 'once',
 *   allowSideEffects?: boolean,
 *   type?: unknown,
 *   defaultValue?: unknown,
 *   concealed?: boolean | 'hidden',
 *   computeOn?: Array<PortOutlet | PortInfo>
 * }} OutputDataConfig
 *
 * @typedef {{
 *   variadic?: string | Function | false,
 *   canonical?: boolean | 'required',
 *   concealed?: boolean | 'hidden',
 *   defaultValue?: unknown,
 *   type?: unknown
 * }} InputDataConfig
 *
 * @typedef {{
 *   variadic?: string | Function | false
 * }} OutputFlowConfig
 */

//
// Public
//

/**
 * Runtime port instance mounted on a chip instance (e.g. `chip.in.value`).
 * A `Port` is callable because it extends `Function` and its constructor
 * replaces `this` with a wrapped function from `makePortRun`.
 */
export class Port extends Function {
  /**
   * @param {unknown} chip
   * @param {PortInfo} portInfo
   * @param {number} [variadicIndex]
   */
  constructor(chip, portInfo, variadicIndex) {
    super();

    const self = /** @type {Port & PortRuntimeShape} */ (makePortRun(portInfo));
    Object.setPrototypeOf(self, Port.prototype);

    self.explicitValue = undefined;

    info(self, portInfo);

    const isVariadic = typeof variadicIndex === 'number' && variadicIndex >= 0;
    const chipRef = /** @type {{ id: string }} */ (chip);

    Object.defineProperties(self, {
      chip: {
        enumerable: true,
        // TODO make this weak?
        value: chip,
      },
      name: {
        enumerable: true,
        get() {
          if (isVariadic && portInfo instanceof VariadicPortInfo) {
            return portInfo.variadicName(variadicIndex);
          }
          return portInfo.name;
        },
      },
      fullName: {
        enumerable: true,
        get() {
          return `${chipRef.id}.${portInfo.isInput ? INPUT : OUTPUT}.${self.name}`;
        },
      },
      // Common port accessors
      isInput: {
        enumerable: true,
        get() {
          return portInfo.isInput;
        },
      },
      isOutput: {
        enumerable: true,
        get() {
          return portInfo.isOutput;
        },
      },
      isFlow: {
        enumerable: true,
        get() {
          return portInfo.isFlow;
        },
      },
      isData: {
        enumerable: true,
        get() {
          return portInfo.isData;
        },
      },
    });

    if (portInfo.isData) {
      const dataPortInfo =
        /** @type {InputDataSinkPortInfo | OutputDataSourcePortInfo} */ (
          portInfo
        );
      Object.defineProperties(self, {
        type: {
          enumerable: true,
          get() {
            // TODO account for variadic
            return dataPortInfo.type;
          },
        },
        defaultValue: {
          enumerable: true,
          get() {
            return isVariadic
              ? dataPortInfo.defaultValue[variadicIndex]
              : dataPortInfo.defaultValue;
          },
        },
        isConcealed: {
          enumerable: true,
          get() {
            return dataPortInfo.isConcealed;
          },
        },
      });

      if (portInfo.isInput) {
        const inputDataPortInfo = /** @type {InputDataSinkPortInfo} */ (
          portInfo
        );
        Object.defineProperties(self, {
          // value: {
          //   enumerable: true,
          //   get: () => {
          //     return self.explicitValue || self.defaultValue;
          //   },
          // },
          //
          isCanonical: {
            enumerable: true,
            get() {
              return inputDataPortInfo.isCanonical;
            },
          },
          isRequired: {
            enumerable: true,
            get() {
              return inputDataPortInfo.isRequired;
            },
          },
          isHidden: {
            enumerable: true,
            get() {
              return inputDataPortInfo.isHidden;
            },
          },
        });
      }
    }

    if (
      portInfo instanceof VariadicPortInfo &&
      portInfo.isVariadic &&
      typeof variadicIndex === 'undefined'
    ) {
      if (!Array.isArray(self.explicitValue)) {
        self.explicitValue = [];
      }

      Object.defineProperties(self, {
        variadic: {
          enumerable: true,
          value: makeVariadicAccessors(
            self,
            (index) => new Port(chip, portInfo, index),
          ),
        },
      });
    }

    return self;
  }

  /** @returns {*} */
  get chip() {
    return undefined;
  }

  /** @returns {unknown} */
  get explicitValue() {
    return this[PORT_EXPLICIT_VALUE];
  }

  /** @param {unknown} value */
  set explicitValue(value) {
    this[PORT_EXPLICIT_VALUE] = value;
  }

  /** @returns {unknown} */
  get defaultValue() {
    return undefined;
  }

  /** @returns {boolean} */
  get isData() {
    return false;
  }

  /** @returns {PortVariadicAccessors | undefined} */
  get variadic() {
    return undefined;
  }

  /** @returns {string} */
  get fullName() {
    return '';
  }

  get value() {
    return this.explicitValue !== undefined
      ? this.explicitValue
      : this.defaultValue;
  }

  toJSON() {
    return info(this).toJSON();
  }
}

export class PortList {
  /**
   * @param {unknown} chip
   * @param {Port[]} ports
   */
  constructor(chip, ports) {
    return new Proxy(ports, {
      get(target, key) {
        if (typeof key === 'string') {
          for (const port of ports) {
            const portInfo = info(port);
            if (portInfo.hasName(key)) {
              if (
                portInfo instanceof VariadicPortInfo &&
                portInfo.isVariadic &&
                portInfo.variadicIndex(key) >= 0
              ) {
                const variadicPorts = port.variadic;
                if (!variadicPorts) {
                  throw new Error(
                    `Variadic port "${portInfo.name}" has no variadic accessors`,
                  );
                }
                return variadicPorts[key];
              }
              return port;
            }
          }
        }
        return Reflect.get(target, key);
      },
      set(target, key, value) {
        if (typeof key !== 'string') {
          return Reflect.set(target, key, value);
        }
        for (const port of ports) {
          const portInfo = info(port);
          if (portInfo.hasName(key)) {
            if (portInfo.isHidden) {
              throw new Error(
                `Attempting to access hidden port "${String(key)}"`,
              );
            }
            if (!portInfo.isData || !portInfo.isInput) {
              throw new Error('Can only set initial value to input data ports');
            }
            if (portInfo instanceof VariadicPortInfo && portInfo.isVariadic) {
              const variadicIndex = portInfo.variadicIndex(key);
              if (variadicIndex >= 0) {
                // Make sure to access the variadic port to create its instance
                const variadicPorts = port.variadic;
                if (!variadicPorts) {
                  throw new Error(
                    `Variadic port "${portInfo.name}" has no variadic accessors`,
                  );
                }
                const variadicPort = variadicPorts[variadicIndex];
                if (!variadicPort) {
                  throw new Error(
                    `Could not resolve variadic port "${portInfo.name}[${variadicIndex}]"`,
                  );
                }
                variadicPort.explicitValue = value;
              } else if (Array.isArray(value)) {
                port.explicitValue = value;
              } else {
                throw new Error('Can not set given value for variadic port');
              }
            } else {
              port.explicitValue = value;
            }
            return true;
          }
        }
        return Reflect.set(target, key, value);
      },
    });
  }
}

export class PortOutlet extends Function {
  /**
   * @param {PortInfo} portInfo
   * @param {number} [variadicIndex]
   */
  constructor(portInfo, variadicIndex) {
    super();

    const outlet = /** @type {PortOutlet & PortRuntimeShape} */ (
      makePortRun(portInfo, true)
    );
    Object.setPrototypeOf(outlet, PortOutlet.prototype);

    info(outlet, portInfo);

    const inputDataPortInfo = portInfo.isInput
      ? /** @type {InputDataSinkPortInfo} */ (portInfo)
      : null;
    const dataPortInfo = portInfo.isData
      ? /** @type {InputDataSinkPortInfo | OutputDataSourcePortInfo} */ (
          portInfo
        )
      : null;

    Object.defineProperties(outlet, {
      isOutlet: {
        enumerable: true,
        value: true,
      },

      name: {
        enumerable: true,
        get() {
          return portInfo.name;
        },
      },

      canonical: {
        enumerable: true,
        get() {
          return inputDataPortInfo ? inputDataPortInfo.canonical : false;
        },
      },

      toJSON: {
        value: function toJSON() {
          return portInfo.toJSON();
        },
      },

      // Common port accessors
      isInput: {
        enumerable: true,
        get() {
          return portInfo.isInput;
        },
      },
      isOutput: {
        enumerable: true,
        get() {
          return portInfo.isOutput;
        },
      },
      isFlow: {
        enumerable: true,
        get() {
          return portInfo.isFlow;
        },
      },
      isData: {
        enumerable: true,
        get() {
          return portInfo.isData;
        },
      },
    });

    if (portInfo.isData) {
      Object.defineProperties(outlet, {
        type: {
          enumerable: true,
          get() {
            return dataPortInfo && dataPortInfo.type;
          },
        },
        defaultValue: {
          enumerable: true,
          get() {
            return dataPortInfo && dataPortInfo.defaultValue;
          },
        },
        isConcealed: {
          enumerable: true,
          get() {
            return dataPortInfo ? dataPortInfo.isConcealed : false;
          },
        },
      });

      if (portInfo.isInput) {
        Object.defineProperties(outlet, {
          isCanonical: {
            enumerable: true,
            get() {
              return inputDataPortInfo ? inputDataPortInfo.isCanonical : false;
            },
          },
          isRequired: {
            enumerable: true,
            get() {
              return inputDataPortInfo ? inputDataPortInfo.isRequired : false;
            },
          },
          isHidden: {
            enumerable: true,
            get() {
              return inputDataPortInfo ? inputDataPortInfo.isHidden : false;
            },
          },
        });
      }
    }

    return outlet;
  }
}

/**
 * Creates lazy accessors for a variadic port.
 *
 * @param {Port & PortRuntimeShape} ownerPort
 * @param {(index: number) => Port} makePortAtIndex
 * @returns {PortVariadicAccessors}
 */
function makeVariadicAccessors(ownerPort, makePortAtIndex) {
  const portInfo = /** @type {VariadicPortInfo} */ (info(ownerPort));
  /**
   * @param {string | symbol | number} key
   * @returns {number}
   */
  const getIndex = (key) => {
    let index = -1;
    if (typeof key === 'string') {
      index = parseInt(key, 10);
      if (isNaN(index)) {
        index = portInfo.variadicIndex(key);
      }
    }
    return index;
  };
  return new Proxy(/** @type {PortVariadicAccessors} */ ([]), {
    /**
     * @param {PortVariadicAccessors} target
     * @param {string | symbol | number} key
     */
    get(target, key) {
      const index = getIndex(key);
      /** @type {string | symbol | number} */
      let lookupKey = key;
      if (index >= 0) {
        const indexKey = index;
        lookupKey = indexKey;
        if (typeof target[indexKey] === 'undefined') {
          const variadicPort = makePortAtIndex(index);
          Object.defineProperties(variadicPort, {
            variadicIndex: {
              enumerable: true,
              value: index,
            },
            explicitValue: {
              enumerable: true,
              get: () => {
                return ownerPort.explicitValue[index];
              },
              set: (value) => {
                ownerPort.explicitValue[index] = value;
              },
            },
          });
          target[indexKey] = variadicPort;
        }
      }
      return Reflect.get(target, lookupKey);
    },
    /**
     * @param {PortVariadicAccessors} target
     * @param {string | symbol | number} key
     */
    deleteProperty(target, key) {
      const index = getIndex(key);
      if (index < 0) return false;
      target.splice(index, 1);
      /** @type {unknown[]} */ (ownerPort.explicitValue).splice(index, 1);
      return true;
    },
  });
}

//
// Info (private)
//

const validPortName = /^[a-z_$][a-z_$0-9]*$/i;
const PORT_EXPLICIT_VALUE = Symbol('portExplicitValue');

export class PortInfo {
  /**
   * @param {ChipInfoLike} chipInfo
   * @param {string} name
   */
  constructor(chipInfo, name) {
    this.assertValidName(name);
    this.chipInfo = chipInfo;
    this.name = name;
  }

  get side() {
    if (this.chipInfo) {
      if (this.chipInfo.inputs.find((outlet) => info(outlet) === this)) {
        return INPUT;
      }
      if (this.chipInfo.outputs.find((outlet) => info(outlet) === this)) {
        return OUTPUT;
      }
    }
  }

  /**
   * @param {string} name
   * @param {string} [side]
   * @returns {string}
   */
  assertValidName(name, side) {
    if (!validPortName.test(name)) {
      throw new Error(`Formally invalid port name "${name}"`);
    }
    if (!side) {
      side = this.side;
    }
    let ports;
    switch (side) {
      case INPUT:
        ports = this.chipInfo.inputs.filter(
          (outlet) => info(outlet).name === name,
        );
        break;
      case OUTPUT:
        ports = this.chipInfo.outputs.filter(
          (outlet) => info(outlet).name === name,
        );
        break;
      default:
        ports = [];
        break;
    }
    ports = ports.filter((outlet) => info(outlet) !== this);
    if (ports.length > 0) {
      throw new Error(`Port with name "${side}.${name}" already exist`);
    }
    return name;
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  hasName(name) {
    return this.name === name;
  }

  get fullName() {
    const side = this.side;
    if (side) {
      return `${side}.${this.name}`;
    }
    return this.name;
  }

  /** @returns {boolean} */
  get isInput() {
    throw new Error('unimplmeneted');
  }

  /** @returns {boolean} */
  get isOutput() {
    throw new Error('unimplmeneted');
  }

  /** @returns {boolean} */
  get isFlow() {
    throw new Error('unimplmeneted');
  }

  /** @returns {boolean} */
  get isData() {
    throw new Error('unimplmeneted');
  }

  get isSink() {
    return Boolean(Number(this.isFlow) ^ Number(this.isInput));
  }

  get isSource() {
    return !this.isSink;
  }

  toJSON() {
    return serializePortInfo(this);
  }
}

export class VariadicPortInfo extends PortInfo {
  /**
   * @param {ChipInfoLike} chipInfo
   * @param {string} name
   * @param {string | Function | false | undefined} variadic
   */
  constructor(chipInfo, name, variadic) {
    super(chipInfo, name);

    // Variadic port
    if (typeof variadic === 'string') {
      if (
        typeof variadic !== 'string' ||
        variadic.search(/{index|letter}/) === -1
      ) {
        throw new Error(
          'Invalid variadic name. Must include {index} and/or {letter}',
        );
      }
      this.variadic = variadicStringNameToFunc(variadic);
    } else {
      this.variadic = variadic || false;
    }
  }

  get isVariadic() {
    return !!this.variadic;
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  hasName(name) {
    if (this.isVariadic && this.variadic(undefined, name) >= 0) {
      return true;
    }
    return super.hasName(name);
  }

  /**
   * @param {number} index
   * @returns {string}
   */
  variadicName(index) {
    return this.variadic(index);
  }

  /**
   * @param {string} name
   * @returns {number}
   */
  variadicIndex(name) {
    return this.variadic(undefined, name);
  }
}

//
// Sources
//

export class InputFlowSourcePortInfo extends PortInfo {
  /**
   * @param {ChipInfoLike} chipInfo
   * @param {string} name
   * @param {InputFlowConfig | Function} [config]
   */
  constructor(chipInfo, name, config = {}) {
    super(chipInfo, name);

    /** @type {InputFlowConfig} */
    const cfg = /** @type {InputFlowConfig} */ (
      typeof config === 'function' ? { execute: config } : config
    );

    this.execute = cfg.execute;
    this.executeCompiler = cfg.executeCompiler;
    this.compiler = undefined;
  }

  get isInput() {
    return true;
  }

  get isOutput() {
    return false;
  }

  get isFlow() {
    return true;
  }

  get isData() {
    return false;
  }
}

export class OutputDataSourcePortInfo extends PortInfo {
  /**
   * @param {ChipInfoLike} chipInfo
   * @param {string} name
   * @param {OutputDataConfig | PortOutlet | PortOutlet[] | Function | string} [config]
   */
  constructor(chipInfo, name, config = {}) {
    super(chipInfo, name);

    /** @type {OutputDataConfig} */
    let cfg = {};
    if (config instanceof Port) {
      throw new Error('Can only compute on outlets');
    } else if (config instanceof PortOutlet) {
      cfg = {
        computeOn: [config],
      };
    } else if (Array.isArray(config)) {
      cfg = {
        computeOn: config.slice(),
      };
    } else if (typeof config === 'function') {
      cfg = {
        compute: config,
      };
    } else if (typeof config === 'string') {
      cfg = {
        type: config,
      };
    } else if (typeof config === 'object' && config) {
      cfg = { ...config };
    }

    // Type
    if (typeof cfg.type === 'string') {
      cfg.type = type(cfg.type);
    }

    this.compute = cfg.compute;
    this.computeCompiler = cfg.computeCompiler;
    this.compiler = undefined;
    // `inline` can be:
    // - `undefined` and will be automatically be decided in
    //   compilaiton phase
    // - `true` to always attempt to inline the output value (ie: duplicate
    //   the computation if used in multiple places)
    // - `false` to never attempt to inline. A variable will be used instead
    // - `"once"` to never inline but also to compute the output value only once
    this.inline = cfg.inline;
    this.allowSideEffects = cfg.allowSideEffects || false;
    this.type = cfg.type;
    // Output ports can be used as internal state (ie: being wrote to and red).
    // When reading a output port, if no value has been assigned to it yet, it
    // will default to its `defaultValue`
    this.defaultValue = cfg.defaultValue;
    // Concealed indicates how the port is hidden:
    // - `true` the port can not be connected from the outside
    // - `'hidden'` the port is not accessible from the outside.
    //    Use this to create internal chip states.
    // TODO 'hidden' output data ports are not enforced in any way
    this.concealed = cfg.concealed || false;

    // Used by compiler to indicate a port that is being
    // set by an execution (rather than be computed)
    this.$isPushing = false;

    let computeOn;

    Object.defineProperties(this, {
      computeOn: {
        enumerable: true,
        get() {
          return computeOn;
        },
        set(value) {
          if (computeOn) {
            for (const computeOnOutletInfo of computeOn) {
              computeOnOutletInfo.computeOutputs.delete(this);
            }
          }
          if (!Array.isArray(value)) value = [value];
          value = value.map((o) => (o instanceof PortInfo ? o : info(o)));
          computeOn = value;
          for (const computeOnOutletInfo of value) {
            computeOnOutletInfo.computeOutputs.add(this);
          }
        },
      },
    });

    this.computeOn = cfg.computeOn || [];
  }

  get isConcealed() {
    return !!this.concealed;
  }

  get isHidden() {
    return this.concealed === 'hidden';
  }

  get isInput() {
    return false;
  }

  get isOutput() {
    return true;
  }

  get isFlow() {
    return false;
  }

  get isData() {
    return true;
  }
}

//
// Sinks
//

export class InputDataSinkPortInfo extends VariadicPortInfo {
  /**
   * @param {ChipInfoLike} chipInfo
   * @param {string} name
   * @param {InputDataConfig | boolean | string} [config]
   */
  constructor(chipInfo, name, config = {}) {
    /** @type {InputDataConfig | boolean | string} */
    let cfg = config;
    super(
      chipInfo,
      name,
      typeof cfg === 'object' && cfg ? cfg.variadic : undefined,
    );

    if (cfg === true) {
      cfg = {
        canonical: true,
      };
    }

    if (typeof cfg === 'string') {
      cfg = {
        type: cfg,
      };
    }
    /** @type {InputDataConfig} */
    const normalized = typeof cfg === 'object' && cfg ? { ...cfg } : {};
    if (typeof normalized.type === 'string') {
      normalized.type = type(normalized.type);
    }

    // Canonical indicates how the port value can be initialized in the
    // wrapper canonical form (by default as a parameter to the new chip constructor)
    // - `true` the port can receive default value from the chip constructor
    // - `'required'` the port must receive a value from the chip constructor
    this.canonical = normalized.canonical || false;
    // Concealed indicates how the port is hidden
    // - `true` the port can not be connected but only receive a direct value
    // - `'hidden'` the port is not accessible. use only with `defaultValue` or
    //   `canonical` to give any meaninful value
    this.concealed = normalized.concealed || false;
    // The default value the port should be having
    this.defaultValue = normalized.defaultValue;
    this.type = normalized.type;

    // Variadic port
    if (this.isVariadic && !Array.isArray(this.defaultValue)) {
      this.defaultValue = [];
    }
  }

  get isCanonical() {
    return !!this.canonical;
  }

  get isRequired() {
    return this.canonical === 'required';
  }

  get isConcealed() {
    return !!this.concealed;
  }

  get isHidden() {
    return this.concealed === 'hidden';
  }

  get isInput() {
    return true;
  }

  get isOutput() {
    return false;
  }

  get isFlow() {
    return false;
  }

  get isData() {
    return true;
  }
}

export class OutputFlowSinkPortInfo extends VariadicPortInfo {
  /**
   * @param {ChipInfoLike} chipInfo
   * @param {string} name
   * @param {OutputFlowConfig} [config]
   */
  constructor(chipInfo, name, config = {}) {
    super(chipInfo, name, config.variadic);

    this.compiler = undefined;
    this.computeOutputs = new Set();
  }

  get isInput() {
    return false;
  }

  get isOutput() {
    return true;
  }

  get isFlow() {
    return true;
  }

  get isData() {
    return false;
  }
}
