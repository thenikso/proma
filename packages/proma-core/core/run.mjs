import { context, info, assertInfo, assert } from './utils.mjs';
import { ExternalReference } from './external.mjs';
import recast from '../vendor/recast.mjs';

export function runFlowPorts(ownerChip, selectPortsToRun) {
  const scope = Scope.current;
  scope.with(ownerChip, () => {
    const chipInfo = info(ownerChip);
    for (const innerChip of chipInfo.chips) {
      const ports = selectPortsToRun(innerChip) || [];
      for (const port of ports) {
        scope.with(port.chip, port);
      }
    }
    for (const subChip of chipInfo.chips) {
      runFlowPorts(subChip, selectPortsToRun);
    }
  });
}

export function makePortRun(portInfo, isOutlet) {
  let port;
  if (portInfo.isInput) {
    if (portInfo.isData) {
      // input data
      port = function inputDataPort() {
        const scope = Scope.current;

        if (isOutlet) {
          const chip = scope.chip;
          assertInfo(chip, portInfo.chipInfo);
          return chip.in[portInfo.name]();
        }

        // Variadic
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
            const value = scope.withReplace(conn.chip, conn);
            checkValueType(port, value);
            return value;
          }
        }

        const portValue = port.value;

        if (portValue instanceof ExternalReference) {
          return portValue.value;
        }

        return portValue;
      };
    } else {
      // input flow
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
          if (!port.$runExecute) {
            port.$runExecute = prepareFunctionToRun(port, portInfo.execute);
          }
          scope.with(port.chip, port.$runExecute);
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
      // output data
      port = function outputDataPort(assignValue) {
        const scope = Scope.current;

        if (isOutlet) {
          const chip = scope.chip;
          assertInfo(chip, portInfo.chipInfo);
          return chip.out[portInfo.name](assignValue);
        }

        // Assign value to this output port
        if (typeof assignValue !== 'undefined') {
          checkValueType(port, assignValue);
          port.$runValue = assignValue;
          return;
        }

        // A trick to only compute this port when computeOn is active if the
        // `$runValue` is set to one of the PortInfo computing this port
        // That is set in `outputFlowPort`.
        if (
          portInfo.computeOn &&
          portInfo.computeOn.length > 0 &&
          !portInfo.computeOn.includes(port.$runValue)
        ) {
          return port.$runValue;
        }

        // Computed output
        if (portInfo.compute) {
          if (
            portInfo.inline === 'once' &&
            typeof port.$runValue !== 'undefined'
          ) {
            return port.$runValue;
          }
          const computed = scope.with(port.chip, portInfo.compute);
          // Cache "once" inlined outputs
          if (portInfo.inline === 'once') {
            checkValueType(port, computed);
            port.$runValue = computed;
          }
          return computed;
        }

        // Connections
        const conn = info(port.chip).getConnectedPorts(port, port.chip)[0];
        if (conn) {
          const value = scope.with(port.chip, conn);
          checkValueType(port, value);
          return value;
        }

        // Value
        if (typeof port.$runValue !== 'undefined') {
          return port.$runValue;
        }
        return port.defaultValue;
      };
    } else {
      // output flow
      port = function outputFlowPort(assignCont) {
        const scope = Scope.current;

        if (isOutlet) {
          const chip = scope.chip;
          assertInfo(chip, portInfo.chipInfo);
          return chip.out[portInfo.name]();
        }

        // Variadic
        if (port.variadic) {
          const res = [];
          for (const p of port.variadic) {
            // Variadic port may be not connected (returning `undefined`) we
            // provide an empty function in that case
            res.push(p ? scope.wrapFunction(p) : () => {});
          }
          return res;
        }

        // ComputeOn
        if (portInfo.computeOutputs.size > 0) {
          for (const name of Array.from(portInfo.computeOutputs).map(
            (p) => p.name,
          )) {
            const outPort = port.chip.out[name];
            outPort.$runValue = portInfo;
            outPort.$runValue = outPort();
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
          port.$runValue = assignCont;
          return;
        }

        // If there is a custom continuation, execute it
        if (typeof port.$runValue === 'function') {
          return port.$runValue();
        }
      };
    }
  }

  return port;
}

class Scope {
  constructor(chips) {
    this.chips = chips || [];
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

function checkValueType(port, value) {
  if (port.type && !port.type.check(value)) {
    console.warn(
      `Invalid value type for port ${port.fullName}, expected type: ${port.type.signature}, got value: ${value}`,
    );
  }
}

const {
  parse,
  visit,
  print,
  types: { namedTypes, builders },
} = recast;

// Similar to what we do in `compile-utils` we need to visit all the calls
// to gather which ports are used (in order to reconstruct the function passing
// port references). Transform all inner function declarations to their wrapped
// version using `scope.wrapFunction(f);`.
// This enables using ports in callbacks or async functions.
function prepareFunctionToRun(port, func) {
  let funcAst = parse(String(func)).program.body[0];
  if (
    namedTypes.ExpressionStatement.check(funcAst) &&
    namedTypes.ArrowFunctionExpression.check(funcAst.expression)
  ) {
    funcAst = funcAst.expression;
  }

  const chip = port.chip;
  const usedInPorts = {};
  const usedOutPorts = {};

  visit(funcAst.body, {
    visitIdentifier(path) {
      if (namedTypes.CallExpression.check(path.parentPath.value)) {
        const portName = path.value.name;
        const inPort = chip.in[portName];
        if (inPort) {
          usedInPorts[portName] = inPort;
          return false;
        }

        const outPort = chip.out[portName];
        if (outPort && !usedOutPorts[portName]) {
          usedOutPorts[portName] = outPort;
          return false;
        }

        // TODO throw? actually it may be a locally defined func
      }
      this.traverse(path);
    },
  });

  const usedPorts = [
    ...Object.entries(usedInPorts),
    ...Object.entries(usedOutPorts),
  ];

  const usedPortsNames = usedPorts.map(([name]) => name);
  const usedPortsFuncs = usedPorts.map(([, f]) => f);

  const makeFunc = new Function(
    ...usedPortsNames,
    `return (${print(funcAst).code})`,
  );

  // NOTE the way this is done is to be used with `scope.with(port.chip, <this return>);`
  // so that this result can be cached for a port but used with different scopes.
  // If scope is baked in earlier, we would leak the scope to other uses of the
  // same port in different chips.
  return () => {
    const scope = Scope.current;
    const scopedFunc = makeFunc(
      ...usedPortsFuncs.map((p) => scope.wrapFunction(p)),
    );
    return scopedFunc();
  };
}
