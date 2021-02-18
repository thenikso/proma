import { info, assert } from './utils.mjs';
import { variadicStringNameToFunc } from './variadic.mjs';
import { makePortRun } from './run.mjs';

export class Port extends Function {
  constructor(chip, portInfo, variadicIndex) {
    super();

    const self = makePortRun(portInfo);
    self.__proto__ = Port.prototype;

    self.explicitValue = portInfo.isVariadic ? [] : undefined;

    info(self, portInfo);

    const isVariadic = variadicIndex >= 0;
    const portName = isVariadic
      ? portInfo.variadicName(variadicIndex)
      : portInfo.name;

    Object.defineProperties(self, {
      chip: {
        enumerable: true,
        value: chip,
      },
      name: {
        enumerable: true,
        value: portName,
      },
      fullName: {
        enumerable: true,
        get() {
          return `${chip.id}.${portInfo.isInput ? 'in' : 'out'}.${portName}`;
        },
      },
    });

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
}

export class PortList {
  constructor(chip, portInfoArray) {
    const ports = Object.freeze(
      portInfoArray.map((portInfo) => new Port(chip, portInfo)),
    );
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
    const outlet = makePortRun(portInfo, true);

    outlet.__proto__ = PortOutlet.prototype;

    info(outlet, portInfo);

    Object.defineProperties(outlet, {
      name: {
        enumerable: true,
        value: portInfo.name,
      },
    });

    return outlet;
  }
}

export class PortInfo {
  constructor(chipInfo, name) {
    this.chipInfo = chipInfo;
    this.name = name;
  }

  hasName(name) {
    return this.name === name;
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
              computeOnOutletInfo.computeOutputs.splice(
                computeOnOutletInfo.computeOutputs.indexOf(this),
                1,
              );
            }
          }
          if (!Array.isArray(value)) value = [value];
          value = value.map((o) => (o instanceof PortInfo ? o : info(o)));
          computeOn = value;
          for (const computeOnOutletInfo of value) {
            computeOnOutletInfo.computeOutputs.push(this);
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
    // The port can receive default value from the chip constructor
    this.canonical = !!config.canonical;
    // The port can not be connected but only receive a direct value
    // TODO honor coneiled attribute when connecting (in compilation)
    this.conceiled = !!config.conceiled;
    // The default value the port should be having
    this.defaultValue = config.defaultValue;

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

  get isVariadic() {
    return !!this.variadic;
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
    this.computeOutputs = [];
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
