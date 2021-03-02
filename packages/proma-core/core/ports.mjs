import { info } from './utils.mjs';
import { variadicStringNameToFunc } from './variadic.mjs';
import { makePortRun } from './run.mjs';
import { serializePortInfo } from './serialize.mjs';
import { type } from './types.mjs';

export const INPUT = 'in';
export const OUTPUT = 'out';

//
// Public
//

export class Port extends Function {
  constructor(chip, portInfo, variadicIndex) {
    super();

    const self = makePortRun(portInfo);
    Object.setPrototypeOf(self, Port.prototype);

    self.explicitValue = portInfo.isVariadic ? [] : undefined;

    info(self, portInfo);

    const isVariadic = variadicIndex >= 0;

    Object.defineProperties(self, {
      chip: {
        enumerable: true,
        value: chip,
      },
      name: {
        enumerable: true,
        get() {
          return isVariadic
            ? portInfo.variadicName(variadicIndex)
            : portInfo.name;
        },
      },
      fullName: {
        enumerable: true,
        get() {
          return `${chip.id}.${portInfo.isInput ? INPUT : OUTPUT}.${self.name}`;
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
      Object.defineProperties(self, {
        type: {
          enumerable: true,
          get() {
            // TODO account for variadic
            return portInfo.type;
          },
        },
      });
    }

    if (portInfo.isInput && portInfo.isData) {
      Object.defineProperties(self, {
        defaultValue: {
          enumerable: true,
          value: isVariadic
            ? portInfo.defaultValue[variadicIndex]
            : portInfo.defaultValue,
        },
        value: {
          enumerable: true,
          get: () => {
            return self.explicitValue || self.defaultValue;
          },
        },
        //
        isCanonical: {
          enumerable: true,
          get() {
            return portInfo.isCanonical;
          },
        },
        isRequired: {
          enumerable: true,
          get() {
            return portInfo.isRequired;
          },
        },
        isConceiled: {
          enumerable: true,
          get() {
            return portInfo.isConceiled;
          },
        },
        isHidden: {
          enumerable: true,
          get() {
            return portInfo.isHidden;
          },
        },
      });
    }

    if (portInfo.isVariadic && typeof variadicIndex === 'undefined') {
      self.variadic = new Proxy([], {
        get(target, key) {
          if (typeof key === 'string') {
            const index = portInfo.variadicIndex(key);
            if (index >= 0) {
              key = index;
              if (typeof target[key] === 'undefined') {
                const variadicPort = new Port(chip, portInfo, index);
                Object.defineProperties(variadicPort, {
                  explicitValue: {
                    enumerable: true,
                    get: () => {
                      return self.explicitValue[index];
                    },
                  },
                });
                target[key] = variadicPort;
              }
            }
          }
          return Reflect.get(target, key);
        },
      });
    }

    return self;
  }

  toJSON() {
    return info(this).toJSON();
  }
}

export class PortList {
  constructor(chip, ports) {
    return new Proxy(ports, {
      get(target, key) {
        for (const port of ports) {
          const portInfo = info(port);
          if (portInfo.hasName(key)) {
            if (portInfo.isVariadic && portInfo.variadicIndex(key) >= 0) {
              return port.variadic[key];
            }
            return port;
          }
        }
        return Reflect.get(target, key);
      },
      set(target, key, value) {
        for (const port of ports) {
          const portInfo = info(port);
          if (portInfo.hasName(key)) {
            if (portInfo.isHidden) {
              throw new Error(`Attempting to access hidden port "${key}"`);
            }
            if (!portInfo.isData || !portInfo.isInput) {
              throw new Error('Can only set initial value to input data ports');
            }
            if (portInfo.isVariadic) {
              const variadicIndex = portInfo.variadicIndex(key);
              if (variadicIndex >= 0) {
                port.explicitValue[variadicIndex] = value;
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
  constructor(portInfo) {
    super();

    const outlet = makePortRun(portInfo, true);
    Object.setPrototypeOf(outlet, PortOutlet.prototype);

    info(outlet, portInfo);

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
          return portInfo.canonical;
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
            // TODO account for variadic
            return portInfo.type;
          },
        },
      });

      if (portInfo.isInput) {
        Object.defineProperties(outlet, {
          isCanonical: {
            enumerable: true,
            get() {
              return portInfo.isCanonical;
            },
          },
          isRequired: {
            enumerable: true,
            get() {
              return portInfo.isRequired;
            },
          },
          isConceiled: {
            enumerable: true,
            get() {
              return portInfo.isConceiled;
            },
          },
          isHidden: {
            enumerable: true,
            get() {
              return portInfo.isHidden;
            },
          },
        });
      }
    }

    return outlet;
  }
}

//
// Info (private)
//

const validPortName = /^[a-z_$][a-z_$0-9]*$/i;

export class PortInfo {
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
    return true;
  }

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

  get isInput() {
    throw new Error('unimplmeneted');
  }

  get isOutput() {
    throw new Error('unimplmeneted');
  }

  get isFlow() {
    throw new Error('unimplmeneted');
  }

  get isData() {
    throw new Error('unimplmeneted');
  }

  get isSink() {
    return !!(this.isFlow ^ this.isInput);
  }

  get isSource() {
    return !this.isSink;
  }

  toJSON() {
    return serializePortInfo(this);
  }
}

//
// Sources
//

export class InputFlowSourcePortInfo extends PortInfo {
  constructor(chipInfo, name, config = {}) {
    super(chipInfo, name);

    if (typeof config === 'function') {
      config = {
        execute: config,
      };
    }

    this.execute = config.execute;
    this.executeCompiler = config.executeCompiler;
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
  constructor(chipInfo, name, config = {}) {
    super(chipInfo, name);

    if (config instanceof Port) {
      throw new Error('Can only compute on outlets');
    } else if (config instanceof PortOutlet) {
      config = {
        computeOn: [config],
      };
    } else if (Array.isArray(config)) {
      config = {
        computeOn: config.slice(),
      };
    } else if (typeof config === 'function') {
      config = {
        compute: config,
      };
    } else if (typeof config === 'string') {
      config = {
        type: config,
      };
    }

    // Type
    if (typeof config.type === 'string') {
      config.type = type(config.type);
    }

    this.compute = config.compute;
    this.computeCompiler = config.computeCompiler;
    this.compiler = undefined;
    // `inline` can be:
    // - `undefined` and will be automatically be decided in
    //   compilaiton phase
    // - `true` to always attempt to inline the output value (ie: duplicate
    //   the computation if used in multiple places)
    // - `false` to never attempt to inline. A variable will be used instead
    // - `"once"` to never inline but also to compute the output value only once
    this.inline = config.inline;
    this.allowSideEffects = config.allowSideEffects || false;
    this.type = config.type;

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

    this.computeOn = config.computeOn || [];
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

export class InputDataSinkPortInfo extends PortInfo {
  constructor(chipInfo, name, config = {}) {
    super(chipInfo, name);

    if (config === true) {
      config = {
        canonical: true,
      };
    }

    if (typeof config === 'string') {
      config = {
        type: config,
      };
    }
    if (typeof config.type === 'string') {
      config.type = type(config.type);
    }

    // Canonical indicates how the port value can be initialized in the
    // wrapper canonical form (by default as a parameter to the new chip constructor)
    // - `true` the port can receive default value from the chip constructor
    // - `'required'` the port must receive a value from the chip constructor
    this.canonical = config.canonical || false;
    // Conceiled indicates how the port is hidden
    // - `true` the port can not be connected but only receive a direct value
    // - `'hidden'` the port is not accessible. use only with `defaultValue` or
    //   `canonical` to give any meaninful value
    this.conceiled = config.conceiled || false;
    // The default value the port should be having
    this.defaultValue = config.defaultValue;
    this.type = config.type;

    // Variadic port
    if (typeof config.variadic === 'string') {
      if (
        typeof config.variadic !== 'string' ||
        config.variadic.search(/{index|letter}/) === -1
      ) {
        throw new Error(
          'Invalid variadic name. Must include {index} and/or {letter}',
        );
      }
      this.variadic = variadicStringNameToFunc(config.variadic);
      if (!Array.isArray(this.defaultValue)) {
        this.defaultValue = [];
      }
    } else {
      this.variadic = config.variadic || false;
    }
  }

  get isCanonical() {
    return !!this.canonical;
  }

  get isRequired() {
    return this.canonical === 'required';
  }

  get isVariadic() {
    return !!this.variadic;
  }

  get isConceiled() {
    return !!this.conceiled;
  }

  get isHidden() {
    return this.conceiled === 'hidden';
  }

  hasName(name) {
    if (this.isVariadic && this.variadic(undefined, name) >= 0) {
      return true;
    }
    return super.hasName(name);
  }

  variadicName(index) {
    return this.variadic(index);
  }

  variadicIndex(name) {
    return this.variadic(undefined, name);
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

export class OutputFlowSinkPortInfo extends PortInfo {
  constructor(chipInfo, name) {
    super(chipInfo, name);

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
