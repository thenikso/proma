import { context, info, assertInfo, assert } from './utils.mjs';

export function makePortRun(portInfo, isOutlet) {
  let port;
  if (portInfo.isInput) {
    if (portInfo.isData) {
      port = function inputDataPort() {
        const scope = Scope.current;

        if (isOutlet) {
          const chip = scope.chip;
          assertInfo(chip, portInfo.chipInfo);
          return chip.in[portInfo.name]();
        }

        if (port.variadic) {
          const res = port.value.slice();
          Array.from(port.variadic).forEach((p, i) => {
            if (p) {
              res[i] = scope.withReplace(p.chip, p);
            }
          });
          return res;
        }

        const parentChip = scope.parentChip;
        if (parentChip && parentChip !== port.chip) {
          const conn = info(parentChip).getConnectedPorts(port, parentChip)[0];
          if (conn) {
            return scope.withReplace(conn.chip, conn);
          }
        }

        return port.value;
      };
    } else {
      port = function inputFlowPort() {
        const scope = Scope.current;

        // Forward outlets to port instance
        if (isOutlet) {
          const chip = scope.chip;
          assertInfo(chip, portInfo.chipInfo);
          return chip.in[portInfo.name]();
        }

        // Execute this input flow
        if (portInfo.execute) {
          scope.with(port.chip, portInfo.execute);
          return;
        }

        // Honor connection
        const conn = info(port.chip).getConnectedPorts(port, port.chip)[0];
        if (conn) {
          scope.with(port.chip, conn);
        }
      };
    }
  } else {
    if (portInfo.isData) {
      port = function outputDataPort(assignValue) {
        const scope = Scope.current;

        if (isOutlet) {
          const chip = scope.chip;
          assertInfo(chip, portInfo.chipInfo);
          return chip.out[portInfo.name](assignValue);
        }

        // A trick to only compute this port when computeOn is active if the
        // `explicitValue` is set to one of the PortInfo computing this port
        // That is set in `outputFlowPort`.
        if (
          portInfo.computeOn &&
          portInfo.computeOn.length > 0 &&
          !portInfo.computeOn.includes(port.explicitValue)
        ) {
          return port.explicitValue;
        }

        // Computed output
        if (portInfo.compute) {
          return scope.with(port.chip, portInfo.compute);
        }

        // Connections
        const conn = info(port.chip).getConnectedPorts(port, port.chip)[0];
        if (conn) {
          return scope.with(port.chip, conn);
        }

        // Assign value to this output port
        if (typeof assignValue !== 'undefined') {
          port.explicitValue = assignValue;
          return;
        }

        // Value
        return port.explicitValue;
      };
    } else {
      port = function outputFlowPort(assignCont) {
        const scope = Scope.current;

        if (isOutlet) {
          const chip = scope.chip;
          assertInfo(chip, portInfo.chipInfo);
          return chip.out[portInfo.name]();
        }

        // TODO emitters?

        // ComputeOn
        if (portInfo.computeOutputs.length > 0) {
          for (const name of portInfo.computeOutputs.map((p) => p.name)) {
            const outPort = port.chip.out[name];
            outPort.explicitValue = portInfo;
            outPort.explicitValue = outPort();
          }
        }

        // Connections
        const parentChip = scope.parentChip;
        if (parentChip && parentChip !== port.chip) {
          const conn = info(parentChip).getConnectedPorts(port, parentChip)[0];
          if (conn) {
            return scope.withReplace(conn.chip, conn);
          }
        }

        // If assigning a continuation, save it in the port explicit value
        if (typeof assignCont !== 'undefined') {
          port.explicitValue = assignCont;
          return;
        }

        // If there is a custom continuation, execute it
        if (typeof port.explicitValue === 'function') {
          return port.explicitValue();
        }
      };
    }
  }

  return port;
}

class Scope {
  constructor() {
    this.chips = [];
  }

  get root() {
    return this.chips[0];
  }

  get chip() {
    return this.chips[this.chips.length - 1];
  }

  get parentChip() {
    return this.chips[this.chips.length - 2];
  }

  push(chip) {
    this.chips.push(chip);
  }

  pop() {
    return this.chips.pop();
  }

  clone() {
    const newScope = new Scope();
    newScope.chips = this.chips.slice();
    return newScope;
  }

  with(chip, f) {
    let didPushChip = false;
    if (this.chip !== chip) {
      this.push(chip);
      didPushChip = true;
    }
    let didAddToContext = false;
    if (this !== context()) {
      context.push(this);
      didAddToContext = true;
    }
    let res = f();
    if (typeof res === 'function') {
      res = this.wrapFunction(res);
    }
    if (didPushChip) {
      this.pop();
    }
    if (didAddToContext) {
      context.pop();
    }
    return res;
  }

  withReplace(chip, f) {
    let oldChip;
    let didChangeChip = false;
    if (this.chip !== chip) {
      oldChip = this.pop();
      this.push(chip);
      didChangeChip = true;
    }
    const res = f();
    if (didChangeChip) {
      this.pop();
      this.push(oldChip);
    }
    return res;
  }

  static get current() {
    let scope = context();
    if (!(scope instanceof Scope)) {
      scope = new Scope();
    }
    return scope;
  }

  wrapFunction(func) {
    const scope = this.clone();
    return function scopeWrapped(...args) {
      context.push(scope);
      const res = func(...args);
      context.pop();
      return res;
    };
  }
}
