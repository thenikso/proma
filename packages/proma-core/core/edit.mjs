import { info } from './utils.mjs';
import { Chip, isChipClass } from './chip.mjs';
import { PortOutlet } from './ports.mjs';
import { PlaceholderChip } from './placeholder.mjs';
import { registry } from './registry.mjs';

const sharedEventsByChipInfo = new WeakMap();

function onSharedEvent(chipInfo, eventName, listener) {
  const sharedEvents = sharedEventsByChipInfo.get(chipInfo) || new Map();

  const listeners = sharedEvents.get(eventName) || new Set();
  listeners.add(listener);
  sharedEvents.set(eventName, listeners);

  sharedEventsByChipInfo.set(chipInfo, sharedEvents);
}

function offSharedEvent(chipInfo, eventName, listener) {
  const sharedEvents = sharedEventsByChipInfo.get(chipInfo);
  if (sharedEvents) {
    if (typeof eventName === 'undefined') {
      sharedEvents.clear();
      return true;
    }
    if (typeof listener === 'undefined') {
      sharedEvents.delete(eventName);
      return true;
    }
    const listeners = sharedEvents.get(eventName);
    if (listeners) {
      listeners.delete(listener);
      return true;
    }
  }
  return false;
}

function getSharedEvents(chipInfo, eventName) {
  const sharedEvents = sharedEventsByChipInfo.get(chipInfo);
  if (!sharedEvents) return [];
  return [...(sharedEvents.get(eventName) || [])];
}

export class EditableChipInfo {
  constructor(chipClass, chipInfo) {
    info(this, chipInfo);

    const self = this;

    //
    // Return class
    //
    Object.defineProperty(this, 'Chip', {
      enumerable: true,
      value: chipClass,
    });

    //
    // Events
    //
    const events = new Map();
    Object.defineProperties(this, {
      on: {
        value: function on(eventName, listener, onAllChipEditors) {
          if (onAllChipEditors) {
            onSharedEvent(chipInfo, eventName, listener);
          } else {
            const listeners = events.get(eventName) || new Set();
            listeners.add(listener);
            events.set(eventName, listeners);
          }
          return self;
        },
      },
      off: {
        value: function off(eventName, listener) {
          if (!offSharedEvent(chipInfo, eventName, listener)) {
            if (typeof eventName === 'undefined') {
              events.clear();
              return self;
            }
            if (typeof listener === 'undefined') {
              events.delete(eventName);
              return self;
            }
            const listeners = events.get(eventName);
            if (listeners) {
              listeners.delete(listener);
            }
          }
          return self;
        },
      },
      dispatch: {
        value: function dispatch(eventName, detail) {
          const names = eventName.split(':');
          let partialName = '';
          const listeners = [];
          for (const n of names) {
            partialName += n;
            listeners.push(...(events.get(partialName) || []));
            listeners.push(...getSharedEvents(chipInfo, partialName));
            partialName += ':';
          }
          if (listeners.length === 0) return true;
          const event = new CustomEvent(eventName, {
            detail,
            cancelable: true,
          });
          for (const listener of listeners) {
            listener(event);
            if (event.cancelBubble) break;
          }
          return !event.defaultPrevented;
        },
      },
    });

    Object.freeze(this);
  }

  //
  // Chips
  //

  addChip(chipToAdd, canonicalValues, id) {
    if (typeof chipToAdd === 'string') {
      // Search in context chips or registry
      const chipClass =
        this.Chip.customChipClasses[chipToAdd] || registry.load(chipToAdd);
      if (isChipClass(chipClass)) {
        chipToAdd = chipClass;
      }
      // Add placeholder chip
      else {
        chipToAdd = new PlaceholderChip(chipClass, chipToAdd, canonicalValues);
      }
    } else if (chipToAdd instanceof Chip) {
      id = canonicalValues;
      canonicalValues = undefined;
    }
    if (isChipClass(chipToAdd)) {
      chipToAdd = new chipToAdd(...(canonicalValues || []));
    }
    if (chipToAdd instanceof this.Chip) {
      throw new Error('Can not add same chip');
    }
    if (id) {
      chipToAdd.id = id;
    }
    const chipInfo = info(this);
    chipInfo.addChip(chipToAdd);
    this.dispatch('chip:add', {
      subject: 'chip',
      operation: 'add',
      chip: chipToAdd,
    });
    return this;
  }

  removeChip(chip) {
    const chipInfo = info(this);
    if (typeof chip === 'string') {
      chip = chipInfo.getChip(chip);
    }
    if (!(chip instanceof Chip)) {
      throw new Error('No chip to remove');
    }
    chipInfo.chips.splice(chipInfo.chips.indexOf(chip), 1);
    // Placeholder chip removal
    if (chip instanceof PlaceholderChip) {
      // Remove chip loader, this will prevent it to resolve and replace itself
      // in the chips array
      chipInfo.chipLoaders.delete(chip);
    }
    // Remove all connections to/from the chip
    for (const [key, value] of chipInfo.sinkConnection.entries()) {
      if (key.chip === chip || value.chip === chip) {
        chipInfo.sinkConnection.delete(key);
      }
    }
    for (let [key, values] of chipInfo.sourceConnections.entries()) {
      if (key.chip === chip) {
        chipInfo.sourceConnections.delete(key);
      } else if (values.some((v) => v.chip === chip)) {
        values = values.filter((v) => v.chip !== chip);
        if (values.length === 0) {
          chipInfo.sourceConnections.delete(key);
        } else {
          chipInfo.sourceConnections.set(key, values);
        }
      }
    }
    this.dispatch('chip:remove', {
      subject: 'chip',
      operation: 'remove',
      chip,
    });
    return this;
  }

  //
  // Ports
  //

  getPort(path, side) {
    const chipInfo = info(this);
    return chipInfo.getPort(path, side);
  }

  addInputFlowPort(name, config) {
    const chipInfo = info(this);
    const port = chipInfo.addInputFlowPort(name, config);
    this.dispatch('port:add:input:flow', {
      subject: 'port',
      operation: 'add',
      side: 'input',
      kind: 'flow',
      port,
    });
    return this;
  }

  addInputDataPort(name, config) {
    const chipInfo = info(this);
    const port = chipInfo.addInputDataPort(name, config);
    this.dispatch('port:add:input:data', {
      subject: 'port',
      operation: 'add',
      side: 'input',
      kind: 'data',
      port,
    });
    return this;
  }

  addOutputFlowPort(name) {
    const chipInfo = info(this);
    const port = chipInfo.addOutputFlowPort(name);
    this.dispatch('port:add:output:flow', {
      subject: 'port',
      operation: 'add',
      side: 'output',
      kind: 'flow',
      port,
    });
    return this;
  }

  addOutputDataPort(name, config) {
    const chipInfo = info(this);
    const port = chipInfo.addOutputDataPort(name, config);
    this.dispatch('port:add:output:data', {
      subject: 'port',
      operation: 'add',
      side: 'output',
      kind: 'data',
      port,
    });
    return this;
  }

  renamePort(port, newName, dryRun) {
    const chipInfo = info(this);
    if (!(port instanceof PortOutlet)) {
      port = chipInfo.getPort(portPath);
    }
    if (!port.isOutlet) {
      throw new Error(`Can only rename chip outlets, got "${port}"`);
    }
    const portInfo = info(port);
    if (portInfo.chipInfo !== chipInfo) {
      throw new Error('Port outlet is not owned by chip');
    }
    newName = portInfo.assertValidName(newName);
    if (dryRun) {
      return newName;
    }
    const oldName = port.name;
    portInfo.name = newName;
    this.dispatch('port:rename', {
      subject: 'port',
      operation: 'rename',
      port,
      name: newName,
      oldName,
    });
    return this;
  }

  setPortValue(port, value) {
    const chipInfo = info(this);
    port = chipInfo.getPort(port);
    if (!port.isData || !port.isInput) {
      throw new Error('port is not a data input');
    }
    if (port.type && !port.type.check(value)) {
      throw new Error(
        `invalid type for default value. expected: ${port.type.signature}`,
      );
    }
    const oldValue = port.explicitValue;
    port.explicitValue = value;
    this.dispatch('port:value', {
      subject: 'port',
      operation: 'value',
      port,
      value,
      oldValue,
    });
    return this;
  }

  movePort(port, beforePort) {}

  removePort(port) {}
  removeInputPort(name) {}
  removeOutputPort(name) {}

  //
  // Single port
  //

  setPortExecute(portName, code) {
    if (typeof code !== 'string') {
      throw new Error('code should be a string');
    }
    const chipInfo = info(this);
    const portOutlet = chipInfo.getInputPortOutlet(portName);
    if (!portOutlet) {
      throw new Error(`No port outlet named "${portName}"`);
    }
    const portInfo = info(portOutlet);
    if (!portInfo.isFlow) {
      throw new Error('Can only set "execute" function to input flow ports');
    }
    const outlets = chipInfo.inputs.filter((p) => info(p).isData);
    outlets.push(...chipInfo.outputs);
    portInfo.execute = makeFunction(code, outlets);
    return this;
  }

  setPortCompute(portName, code) {
    if (typeof code !== 'string') {
      throw new Error('code should be a string');
    }
    const chipInfo = info(this);
    const portOutlet = chipInfo.getOutputPortOutlet(portName);
    if (!portOutlet) {
      throw new Error(`No port outlet named "${portName}"`);
    }
    const portInfo = info(portOutlet);
    if (!portInfo.isData) {
      throw new Error('Can only set "compute" function to output data ports');
    }
    const outlets = chipInfo.inputs.filter((p) => info(p).isData);
    if (portInfo.allowSideEffects) {
      outlets.push(...chipInfo.outputs);
    }
    portInfo.compute = makeFunction(code, outlets);
    return this;
  }

  //
  // Connections
  //

  hasConnections(port) {
    const chipInfo = info(this);
    return chipInfo.getConnectedPorts(port).length > 0;
  }

  probeConnection(portA, portB) {
    // TODO return error if not connectable and order from/to
    // and connections that need removal to allow this
    const chipInfo = info(this);
    chipInfo.addConnection(portA, portB, true);
    return this;
  }

  addConnection(portA, portB) {
    const chipInfo = info(this);
    const connection = chipInfo.addConnection(portA, portB, false, true);
    this.dispatch('connection:add', {
      subject: 'connection',
      operation: 'add',
      ...connection,
    });
    return this;
  }

  removeConnection(portA, portB) {
    const chipInfo = info(this);
    if (typeof portA === 'string' || Array.isArray(portA)) {
      portA = chipInfo.getPort(portA, 'in');
    }
    if (typeof portB === 'string' || Array.isArray(portB)) {
      portB = chipInfo.getPort(portB, 'out');
    }
    if (portA instanceof PortOutlet) {
      portA = info(portA);
    }
    if (portB instanceof PortOutlet) {
      portB = info(portB);
    }
    // Delete from sinkConnection
    if (!portB || chipInfo.sinkConnection.get(portA) === portB) {
      chipInfo.sinkConnection.delete(portA);
    }
    if (chipInfo.sinkConnection.get(portB) === portA) {
      chipInfo.sinkConnection.delete(portB);
    }
    // Delete from sourceConnections
    const aConns = chipInfo.sourceConnections.get(portA);
    if (aConns) {
      if (portB) {
        if (aConns.includes(portB)) {
          aConns.splice(aConns.indexOf(portB), 1);
        }
      } else {
        for (const otherPort of aConns) {
          if (chipInfo.sinkConnection.get(otherPort) === portA) {
            chipInfo.sinkConnection.delete(otherPort);
          }
        }
      }
      if (!portB || aConns.length === 0) {
        chipInfo.sourceConnections.delete(portA);
      }
    }
    const bConns = chipInfo.sourceConnections.get(portB);
    if (bConns && bConns.includes(portA)) {
      bConns.splice(bConns.indexOf(portA), 1);
      if (bConns.length === 0) {
        chipInfo.sourceConnections.delete(portB);
      }
    }
    this.dispatch('connection:remove', {
      subject: 'connection',
      operation: 'remove',
      // TODO report removed connections
      // connections,
    });
    return this;
  }
}

function makeFunction(code, outlets) {
  const outletsNames = outlets.map((p) => p.name);
  const makeFunc = new Function(...outletsNames, 'return (' + code + ')');
  const res = makeFunc.apply(undefined, outlets);
  return res;
}
