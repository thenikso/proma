import { context, info, assert } from './utils.mjs';
import { Chip, isChipClass } from './chip.mjs';
import { PortOutlet } from './ports.mjs';
import { PlaceholderChip } from './placeholder.mjs';
import { registry as defaultRegistry } from './registry.mjs';
import { event, switchChip, externalGet } from './api.mjs';
import { type } from './types.mjs';

const VALID_CUSTOM_CHIPS = {
  event,
  switch: switchChip,
  external: (_, ext) => externalGet(ext),
};
const CUSTOM_CHIP_REGEXP = new RegExp(
  `^(.+?):(${Object.keys(VALID_CUSTOM_CHIPS).join('|')})(?:\\((.+)\\))?$`,
  'i',
);

export function edit(ChipClass, registry) {
  // TODO accept an optional new "build" function that can have deleteChip..?
  if (!ChipClass.editable) {
    throw new Error('Chip is not editable');
  }
  return new EditableChipInfo(ChipClass, registry);
}

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

class EditableChipInfo {
  constructor(chipClass, registry = defaultRegistry) {
    const chipInfo = info(chipClass);
    info(this, chipInfo);

    // We always copy the registry so that we can load new things in it
    // and keep those local to the chip.
    if (!chipInfo.registry) {
      chipInfo.registry = registry || defaultRegistry;
    }
    chipInfo.registry = chipInfo.registry.copy;

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
          const listeners = [
            ...(events.get('*') || []),
            ...getSharedEvents(chipInfo, '*'),
          ];
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

  get registry() {
    return info(this).registry;
  }

  //
  // Use
  //

  async addUse(libraryURI) {
    const chipInfo = info(this);
    const registry = chipInfo.registry;
    await registry.use(libraryURI);
    return this;
  }

  removeUse(libraryURI) {
    const chipInfo = info(this);
    const registry = chipInfo.registry;
    registry.unuse(libraryURI);
    return this;
  }

  //
  // Chips
  //

  allChips() {
    const chipInfo = info(this);
    return chipInfo.chips.slice();
  }

  getChip(id) {
    const chipInfo = info(this);
    return chipInfo.getChip(id);
  }

  addChip(chipToAdd, canonicalValues, id) {
    const chipInfo = info(this);
    if (typeof chipToAdd === 'string') {
      let chipClass;
      // Special case for custom chips in the form of
      // `my/chip/Uri:event(portA:number, portB:String)`
      const [, cleanURI, customChip, customParams] =
        CUSTOM_CHIP_REGEXP.exec(chipToAdd) || [];
      if (cleanURI) {
        // Try again with a custom chip class (ignoring the custom params).
        // TODO is this useful?
        chipClass = this.Chip.customChipClasses[cleanURI];
        if (!chipClass) {
          const chipCreator = VALID_CUSTOM_CHIPS[customChip];
          if (!chipCreator) {
            throw new Error(`Could not create custom chip "${chipToAdd}"`);
          }
          const resolvedCustomParams = (customParams || '')
            .split(',')
            .map((x) => x.trim());
          chipClass = chipCreator(cleanURI, ...resolvedCustomParams);
        }
      }
      // Search in context chips or registry
      else {
        chipClass =
          this.Chip.customChipClasses[chipToAdd] ||
          chipInfo.registry.load(chipToAdd);
      }
      // Chip to add will be instantiated from this class
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
      context.push(chipInfo);
      try {
        chipToAdd = new chipToAdd(...(canonicalValues || []));
      } catch (e) {
        context.pop();
        throw e;
      }
      context.pop();
    } else {
      chipInfo.addChip(chipToAdd);
    }
    if (chipToAdd instanceof this.Chip) {
      throw new Error('Can not add same chip');
    }
    if (id) {
      chipToAdd.id = id;
    }
    while (chipInfo.getChip(chipToAdd.id) !== chipToAdd) {
      chipToAdd.id = info(chipToAdd).makeChipId();
    }
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
    if (!(chip instanceof Chip) && !(chip instanceof PlaceholderChip)) {
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

  setChipId(chip, id, dryRun) {
    const chipInfo = info(this);
    chip = chipInfo.getChip(chip);
    assert(chip, 'Provided sub-chip is not in the Chip body');
    if (chip.id === id) {
      return this;
    }
    const withNewId = chipInfo.chips.filter((c) => c.id === id);
    if (withNewId.length > 0) {
      throw new Error(`Sub-chip with id "${id}" is already present`);
    }
    if (!dryRun) {
      const oldId = chip.id;
      chip.id = id;
      this.dispatch('chip:id', {
        subject: 'chip',
        operation: 'id',
        chip,
        id,
        oldId,
      });
    }
    return this;
  }

  setChipLabel(chip, label) {
    const chipInfo = info(this);
    chip = chipInfo.getChip(chip);
    assert(chip, 'Provided sub-chip is not in the Chip body');
    chip.label = label;
    return this;
  }

  //
  // Outlets
  //

  getPort(path, side) {
    const chipInfo = info(this);
    return chipInfo.getPort(path, side);
  }

  addInputFlowOutlet(name, config) {
    const chipInfo = info(this);
    const outlet = chipInfo.addInputFlowPort(name, config);
    this.dispatch('outlet:add:input:flow', {
      subject: 'outlet',
      operation: 'add',
      side: 'input',
      kind: 'flow',
      outlet,
    });
    return this;
  }

  addInputDataOutlet(name, config) {
    const chipInfo = info(this);
    const outlet = chipInfo.addInputDataPort(name, config);
    this.dispatch('outlet:add:input:data', {
      subject: 'outlet',
      operation: 'add',
      side: 'input',
      kind: 'data',
      outlet,
    });
    return this;
  }

  addOutputFlowOutlet(name) {
    const chipInfo = info(this);
    const outlet = chipInfo.addOutputFlowPort(name);
    this.dispatch('outlet:add:output:flow', {
      subject: 'outlet',
      operation: 'add',
      side: 'output',
      kind: 'flow',
      outlet,
    });
    return this;
  }

  addOutputDataOutlet(name, config) {
    const chipInfo = info(this);
    const outlet = chipInfo.addOutputDataPort(name, config);
    this.dispatch('outlet:add:output:data', {
      subject: 'outlet',
      operation: 'add',
      side: 'output',
      kind: 'data',
      outlet,
    });
    return this;
  }

  renameOutlet(outlet, newName, dryRun) {
    const chipInfo = info(this);
    if (!(outlet instanceof PortOutlet)) {
      outlet = chipInfo.getPort(outlet);
    }
    if (!outlet.isOutlet) {
      throw new Error(`Can only rename chip outlets, got "${outlet}"`);
    }
    const portInfo = info(outlet);
    if (portInfo.chipInfo !== chipInfo) {
      throw new Error('Port outlet is not owned by chip');
    }
    newName = portInfo.assertValidName(newName);
    if (!dryRun) {
      const oldName = outlet.name;
      portInfo.name = newName;
      this.dispatch('outlet:rename', {
        subject: 'outlet',
        operation: 'rename',
        outlet,
        name: newName,
        oldName,
      });
    }
    return this;
  }

  moveOutlet(port, beforePort) {}

  removeOutlet(port) {}
  removeInputOutlet(name) {}
  removeOutputOutlet(name) {}

  setOutletType(port, newType) {
    const chipInfo = info(this);
    if (!(port instanceof PortOutlet)) {
      port = chipInfo.getPort(port);
    }
    if (!port.isOutlet) {
      throw new Error(`Can only set chip outlet type, got "${port}"`);
    }
    if (!port.isData) {
      throw new Error(`Can only set data type for data outlets, got "${port}"`);
    }
    const portInfo = info(port);
    if (portInfo.chipInfo !== chipInfo) {
      throw new Error('Port outlet is not owned by chip');
    }
    port.type = type(newType);
    return this;
  }

  //
  // Ports (of sub-chips)
  //

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

  setPortVariadicCount(port, variadicCount) {
    const chipInfo = info(this);
    port = chipInfo.getPort(port);
    // Only operate on variadic ports
    if (!port.variadic) {
      throw new Error('port is not variadic');
    }
    const oldVariadicCount = Array.from(port.variadic).length;
    // Allow for `setPortVariadicCount(port, "+1")`
    if (typeof variadicCount === 'string') {
      const countDelta = parseInt(variadicCount);
      if (isNaN(countDelta)) {
        throw new Error(`invalid variadicCount "${variadicCount}"`);
      }
      variadicCount = oldVariadicCount + countDelta;
    }
    // Ignore if count doesnt change
    if (variadicCount === oldVariadicCount) return this;
    // Increment variadic ports
    if (variadicCount > oldVariadicCount) {
      for (let i = oldVariadicCount; i < variadicCount; i++) {
        // Accessing the port will create a new variadic port instance via
        // the `variadic` access Proxy
        port.variadic[i];
      }
    }
    // Disconnect and delete variadic ports
    else {
      for (let i = variadicCount; i < oldVariadicCount; i++) {
        const portToRemove = port.variadic[i];
        this.removeConnection(portToRemove);
        delete port.variadic[i];
      }
    }
    this.dispatch('port:variadicCount', {
      subject: 'port',
      operation: 'variadicCount',
      port,
      variadicCount,
      oldVariadicCount,
    });
    return this;
  }

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
