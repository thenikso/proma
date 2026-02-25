// @ts-check
import { context, info, assert } from './utils.mjs';
import { Chip, isChipClass } from './chip.mjs';
import { PortOutlet } from './ports.mjs';
import { PlaceholderChip } from './placeholder.mjs';
import { registry as defaultRegistry } from './registry.mjs';
import { event, switchChip, externalGet } from './api.mjs';
import { type } from './types.mjs';
import { EditHistory } from './history.mjs';

/**
 * @typedef {import('./chip.mjs').PortSelector} PortSelector
 * @typedef {import('./chip.mjs').ConnectionEndpointSelector} ConnectionEndpointSelector
 * @typedef {import('./chip.mjs').ChipConnectionEndpoint} ChipConnectionEndpoint
 * @typedef {{ source: ChipConnectionEndpoint, sink: ChipConnectionEndpoint }} PortConnection
 * @typedef {{
 *   editable?: boolean,
 *   customChipClasses?: Record<string, unknown>
 * }} EditableChipClassMeta
 * @typedef {typeof Chip & EditableChipClassMeta} EditableChipClass
 * @typedef {{
 *   isOutlet?: boolean,
 *   isData?: boolean,
 *   isInput?: boolean,
 *   isFlow?: boolean,
 *   name?: string,
 *   type?: { check: (value: unknown) => boolean, signature?: string },
 *   explicitValue?: unknown,
 *   variadic?: Array<unknown>
 * }} EditablePortLike
 * @typedef {(event: CustomEvent) => void} EditEventListener
 * @typedef {{
 *   undo?: () => unknown,
 *   redo?: () => unknown,
 *   replaying?: boolean,
 *   [key: string]: unknown
 * }} EditEventDetail
 * @typedef {(eventName: string, detail?: EditEventDetail) => boolean} EditDispatch
 * @typedef {(uri: string, ...args: unknown[]) => typeof Chip} CustomChipFactory
 */

/** @type {{ [kind: string]: CustomChipFactory }} */
const VALID_CUSTOM_CHIPS = {
  /** @param {string} uri */
  event,
  /** @param {string} uri */
  switch: switchChip,
  /** @param {string} _ @param {unknown} ext */
  external: (_, ext) => externalGet(/** @type {string | object} */ (ext)),
};
const CUSTOM_CHIP_REGEXP = new RegExp(
  `^(.+?):(${Object.keys(VALID_CUSTOM_CHIPS).join('|')})(?:\\((.+)\\))?$`,
  'i',
);

/**
 * Creates an editable facade for a chip class.
 *
 * @param {unknown} ChipClass
 * @param {import('./registry.mjs').Registry} [registry]
 * @returns {EditableChipInfo}
 */
export function edit(ChipClass, registry) {
  // TODO accept an optional new "build" function that can have deleteChip..?
  const editableChipClass = /** @type {EditableChipClass} */ (ChipClass);
  if (!editableChipClass.editable) {
    throw new Error('Chip is not editable');
  }
  return new EditableChipInfo(editableChipClass, registry);
}

/**
 * Resolve and validate an outlet belonging to the provided chip info.
 *
 * @param {import('./chip.mjs').ChipInfo} chipInfo
 * @param {PortSelector} outlet
 * @returns {PortOutlet}
 */
function resolveOutlet(chipInfo, outlet) {
  const resolved =
    outlet instanceof PortOutlet ? outlet : chipInfo.getPort(outlet);
  if (!(resolved instanceof PortOutlet)) {
    throw new Error('Can only use chip outlets');
  }
  if (!(/** @type {{ isOutlet?: boolean }} */ (resolved).isOutlet)) {
    throw new Error(`Can only use chip outlets, got "${resolved}"`);
  }
  return resolved;
}

/**
 * Resolve a sub-chip port from any accepted selector.
 *
 * @param {import('./chip.mjs').ChipInfo} chipInfo
 * @param {PortSelector} port
 * @returns {EditablePortLike}
 */
function resolvePort(chipInfo, port) {
  return /** @type {EditablePortLike} */ (chipInfo.getPort(port));
}

/** @type {WeakMap<import('./chip.mjs').ChipInfo, Map<string, Set<EditEventListener>>>} */
const sharedEventsByChipInfo = new WeakMap();

/**
 * @param {import('./chip.mjs').ChipInfo} chipInfo
 * @param {string} eventName
 * @param {EditEventListener} listener
 */
function onSharedEvent(chipInfo, eventName, listener) {
  const sharedEvents = sharedEventsByChipInfo.get(chipInfo) || new Map();

  const listeners = sharedEvents.get(eventName) || new Set();
  listeners.add(listener);
  sharedEvents.set(eventName, listeners);

  sharedEventsByChipInfo.set(chipInfo, sharedEvents);
}

/**
 * @param {import('./chip.mjs').ChipInfo} chipInfo
 * @param {string} [eventName]
 * @param {EditEventListener} [listener]
 * @returns {boolean}
 */
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

/**
 * @param {import('./chip.mjs').ChipInfo} chipInfo
 * @param {string} eventName
 * @returns {EditEventListener[]}
 */
function getSharedEvents(chipInfo, eventName) {
  const sharedEvents = sharedEventsByChipInfo.get(chipInfo);
  if (!sharedEvents) return [];
  return [...(sharedEvents.get(eventName) || [])];
}

// Private helpers for compound operations — remove connections without firing
// individual connection:remove events that would each create undo entries.

/**
 * @param {import('./chip.mjs').ChipInfo} chipInfo
 * @param {Chip | PlaceholderChip} chip
 * @returns {PortConnection[]}
 */
function collectConnectionsForChip(chipInfo, chip) {
  const connections = [];
  for (const [sink, source] of chipInfo.sinkConnection.entries()) {
    if (sink.chip === chip || source.chip === chip)
      connections.push({ source, sink });
  }
  return connections;
}

/**
 * @param {import('./chip.mjs').ChipInfo} chipInfo
 * @param {ChipConnectionEndpoint} portInfo
 * @returns {PortConnection[]}
 */
function collectConnectionsForPort(chipInfo, portInfo) {
  const connections = [];
  const sinkTarget = chipInfo.sinkConnection.get(portInfo);
  if (sinkTarget) connections.push({ source: sinkTarget, sink: portInfo });
  for (const sink of chipInfo.sourceConnections.get(portInfo) || [])
    connections.push({ source: portInfo, sink });
  return connections;
}

/**
 * @param {import('./chip.mjs').ChipInfo} chipInfo
 * @param {PortConnection[]} connections
 * @returns {void}
 */
function removeConnectionsFromMaps(chipInfo, connections) {
  for (const { source, sink } of connections) {
    chipInfo.sinkConnection.delete(sink);
    const sinks = chipInfo.sourceConnections.get(source);
    if (sinks) {
      sinks.splice(sinks.indexOf(sink), 1);
      if (sinks.length === 0) chipInfo.sourceConnections.delete(source);
    }
  }
}

/**
 * @param {import('./chip.mjs').ChipInfo} chipInfo
 * @param {PortConnection[]} connections
 * @returns {void}
 */
function addConnectionsToMaps(chipInfo, connections) {
  for (const { source, sink } of connections) {
    chipInfo.sinkConnection.set(sink, source);
    const sinks = chipInfo.sourceConnections.get(source);
    if (sinks) {
      if (!sinks.includes(sink)) sinks.push(sink);
    } else {
      chipInfo.sourceConnections.set(source, [sink]);
    }
  }
}

class EditableChipInfo {
  /**
   * @param {EditableChipClass} chipClass
   * @param {import('./registry.mjs').Registry} [registry]
   */
  constructor(chipClass, registry = defaultRegistry) {
    const chipInfo = info(chipClass);
    info(this, chipInfo);
    /** @type {EditableChipClass} */
    this.Chip = chipClass;
    /** @type {EditDispatch} */
    this.dispatch = () => true;

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

    //
    // History
    //
    const history = new EditHistory();

    Object.defineProperties(this, {
      on: {
        /**
         * @param {string} eventName
         * @param {EditEventListener} listener
         * @param {boolean} [onAllChipEditors]
         * @returns {EditableChipInfo}
         */
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
        /**
         * @param {string} [eventName]
         * @param {EditEventListener} [listener]
         * @returns {EditableChipInfo}
         */
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
        /**
         * @param {string} eventName
         * @param {EditEventDetail} [detail]
         * @returns {boolean}
         */
        value: function dispatch(eventName, detail) {
          // Auto-record when undo/redo closures are embedded and not replaying
          if (!history.isReplaying && detail?.undo && detail?.redo) {
            history._record({
              description: eventName,
              execute: detail.redo,
              undo: detail.undo,
            });
          }
          // Annotate event detail so listeners can distinguish replay from user action
          if (history.isReplaying && detail) {
            detail.replaying = true;
          }
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
      canUndo: { get: () => history.canUndo, enumerable: true },
      canRedo: { get: () => history.canRedo, enumerable: true },
      history: { value: history, enumerable: true },
      undo: {
        value: () => {
          history.undo();
          return self;
        },
        enumerable: true,
      },
      redo: {
        value: () => {
          history.redo();
          return self;
        },
        enumerable: true,
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

  /**
   * Loads a library namespace into the local editable registry.
   *
   * @param {string} libraryURI
   * @returns {Promise<EditableChipInfo>}
   */
  async addUse(libraryURI) {
    const chipInfo = info(this);
    const registry = chipInfo.registry;
    await registry.use(libraryURI);
    return this;
  }

  /**
   * Removes a previously loaded library namespace.
   *
   * @param {string} libraryURI
   * @returns {EditableChipInfo}
   */
  removeUse(libraryURI) {
    const chipInfo = info(this);
    const registry = chipInfo.registry;
    registry.unuse(libraryURI);
    return this;
  }

  //
  // Chips
  //

  /**
   * @returns {(Chip | PlaceholderChip)[]}
   */
  allChips() {
    const chipInfo = info(this);
    return chipInfo.chips.slice();
  }

  /**
   * @param {string} id
   * @returns {Chip | PlaceholderChip}
   */
  getChip(id) {
    const chipInfo = info(this);
    return chipInfo.getChip(id);
  }

  /**
   * Adds a chip instance/class/uri to the editable graph.
   *
   * @param {string | typeof Chip | Chip | PlaceholderChip} chipToAdd
   * @param {unknown[] | string} [canonicalValues]
   * @param {string} [id]
   * @returns {EditableChipInfo}
   */
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
      id = typeof canonicalValues === 'string' ? canonicalValues : id;
      canonicalValues = undefined;
    }

    if (isChipClass(chipToAdd)) {
      context.push(chipInfo);
      try {
        chipToAdd = new chipToAdd(
          .../** @type {unknown[]} */ (canonicalValues || []),
        );
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
    const chip = chipToAdd;
    const undo = () => this.removeChip(chip);
    const redo = () => {
      chipInfo.addChip(chip);
      this.dispatch('chip:add', {
        subject: 'chip',
        operation: 'add',
        data: { chip },
        undo,
        redo,
      });
    };
    this.dispatch('chip:add', {
      subject: 'chip',
      operation: 'add',
      data: { chip },
      undo,
      redo,
    });
    return this;
  }

  /**
   * Removes a sub-chip and all of its connections.
   *
   * @param {string | Chip | PlaceholderChip} chip
   * @returns {EditableChipInfo}
   */
  removeChip(chip) {
    const chipInfo = info(this);
    if (typeof chip === 'string') {
      chip = chipInfo.getChip(chip);
    }
    if (!(chip instanceof Chip) && !(chip instanceof PlaceholderChip)) {
      throw new Error('No chip to remove');
    }
    // Placeholder chip removal
    if (chip instanceof PlaceholderChip) {
      // Remove chip loader, this will prevent it to resolve and replace itself
      // in the chips array
      chipInfo.chipLoaders.delete(chip);
    }
    // Capture port values before removal
    const portValues = [];
    const chipInfoInner = info(chip);
    if (chipInfoInner) {
      for (const portOutlet of chipInfoInner.inputs) {
        const portInfo = info(portOutlet);
        if (portInfo.isData) {
          const portInstance = chip['in'][portOutlet.name];
          if (portInstance && portInstance.explicitValue !== undefined) {
            portValues.push({
              portName: portOutlet.name,
              value: portInstance.explicitValue,
            });
          }
        }
      }
    }
    // Collect and remove connections atomically (no individual undo entries)
    const connectionsToRemove = collectConnectionsForChip(chipInfo, chip);
    removeConnectionsFromMaps(chipInfo, connectionsToRemove);
    if (connectionsToRemove.length > 0) {
      // Notification-only dispatch (no undo/redo → not recorded)
      this.dispatch('connection:remove', {
        subject: 'connection',
        operation: 'remove',
        data: { connections: connectionsToRemove },
      });
    }
    chipInfo.chips.splice(chipInfo.chips.indexOf(chip), 1);
    const undo = () => {
      chipInfo.addChip(chip);
      this.dispatch('chip:add', {
        subject: 'chip',
        operation: 'add',
        data: { chip },
      });
      if (connectionsToRemove.length > 0) {
        addConnectionsToMaps(chipInfo, connectionsToRemove);
        this.dispatch('connection:add', {
          subject: 'connection',
          operation: 'add',
          data: { connections: connectionsToRemove },
        });
      }
      for (const { portName, value } of portValues) {
        try {
          const p = chip['in'][portName];
          if (p) p.explicitValue = value;
        } catch (e) {}
      }
    };
    const redo = () => this.removeChip(chip);
    this.dispatch('chip:remove', {
      subject: 'chip',
      operation: 'remove',
      data: { chip, connections: connectionsToRemove, portValues },
      undo,
      redo,
    });
    return this;
  }

  /**
   * @param {string | Chip | PlaceholderChip} chip
   * @param {string} id
   * @param {boolean} [dryRun]
   * @returns {EditableChipInfo}
   */
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
      const undo = () => this.setChipId(chip, oldId);
      const redo = () => this.setChipId(chip, id);
      this.dispatch('chip:id', {
        subject: 'chip',
        operation: 'id',
        data: { chip, id, oldId },
        undo,
        redo,
      });
    }
    return this;
  }

  /**
   * @param {string | Chip | PlaceholderChip} chip
   * @param {string} label
   * @returns {EditableChipInfo}
   */
  setChipLabel(chip, label) {
    const chipInfo = info(this);
    chip = chipInfo.getChip(chip);
    assert(chip, 'Provided sub-chip is not in the Chip body');
    const oldLabel = chip.label;
    chip.label = label;
    const undo = () => this.setChipLabel(chip, oldLabel);
    const redo = () => this.setChipLabel(chip, label);
    this.dispatch('chip:label', {
      subject: 'chip',
      operation: 'label',
      data: { chip, label, oldLabel },
      undo,
      redo,
    });
    return this;
  }

  //
  // Outlets
  //

  /**
   * @param {PortSelector} path
   * @param {'in' | 'out'} [side]
   * @returns {import('./ports.mjs').Port | PortOutlet | null}
   */
  getPort(path, side) {
    const chipInfo = info(this);
    return chipInfo.getPort(path, side);
  }

  /**
   * @param {string} name
   * @param {object | Function} [config]
   * @returns {EditableChipInfo}
   */
  addInputFlowOutlet(name, config) {
    const chipInfo = info(this);
    const outlet = chipInfo.addInputFlowPort(name, config);
    const undo = () => this.removeOutlet(outlet);
    const redo = () => {
      chipInfo.inputs.push(outlet);
      this.dispatch('outlet:add:input:flow', {
        subject: 'outlet',
        operation: 'add',
        side: 'input',
        kind: 'flow',
        data: { outlet },
        undo,
        redo,
      });
    };
    this.dispatch('outlet:add:input:flow', {
      subject: 'outlet',
      operation: 'add',
      side: 'input',
      kind: 'flow',
      data: { outlet },
      undo,
      redo,
    });
    return this;
  }

  /**
   * @param {string} name
   * @param {object | boolean | string} [config]
   * @returns {EditableChipInfo}
   */
  addInputDataOutlet(name, config) {
    const chipInfo = info(this);
    const outlet = chipInfo.addInputDataPort(name, config);
    const undo = () => this.removeOutlet(outlet);
    const redo = () => {
      chipInfo.inputs.push(outlet);
      this.dispatch('outlet:add:input:data', {
        subject: 'outlet',
        operation: 'add',
        side: 'input',
        kind: 'data',
        data: { outlet },
        undo,
        redo,
      });
    };
    this.dispatch('outlet:add:input:data', {
      subject: 'outlet',
      operation: 'add',
      side: 'input',
      kind: 'data',
      data: { outlet },
      undo,
      redo,
    });
    return this;
  }

  /**
   * @param {string} name
   * @returns {EditableChipInfo}
   */
  addOutputFlowOutlet(name) {
    const chipInfo = info(this);
    const outlet = chipInfo.addOutputFlowPort(name);
    const undo = () => this.removeOutlet(outlet);
    const redo = () => {
      chipInfo.outputs.push(outlet);
      this.dispatch('outlet:add:output:flow', {
        subject: 'outlet',
        operation: 'add',
        side: 'output',
        kind: 'flow',
        data: { outlet },
        undo,
        redo,
      });
    };
    this.dispatch('outlet:add:output:flow', {
      subject: 'outlet',
      operation: 'add',
      side: 'output',
      kind: 'flow',
      data: { outlet },
      undo,
      redo,
    });
    return this;
  }

  /**
   * @param {string} name
   * @param {object | Function | PortOutlet | PortOutlet[] | string} [config]
   * @returns {EditableChipInfo}
   */
  addOutputDataOutlet(name, config) {
    const chipInfo = info(this);
    const outlet = chipInfo.addOutputDataPort(name, config);
    const undo = () => this.removeOutlet(outlet);
    const redo = () => {
      chipInfo.outputs.push(outlet);
      this.dispatch('outlet:add:output:data', {
        subject: 'outlet',
        operation: 'add',
        side: 'output',
        kind: 'data',
        data: { outlet },
        undo,
        redo,
      });
    };
    this.dispatch('outlet:add:output:data', {
      subject: 'outlet',
      operation: 'add',
      side: 'output',
      kind: 'data',
      data: { outlet },
      undo,
      redo,
    });
    return this;
  }

  /**
   * @param {PortSelector} outlet
   * @param {string} newName
   * @param {boolean} [dryRun]
   * @returns {EditableChipInfo}
   */
  renameOutlet(outlet, newName, dryRun) {
    const chipInfo = info(this);
    const resolvedOutlet = resolveOutlet(chipInfo, outlet);
    const portInfo = info(resolvedOutlet);
    if (portInfo.chipInfo !== chipInfo) {
      throw new Error('Port outlet is not owned by chip');
    }
    newName = portInfo.assertValidName(newName);
    if (!dryRun) {
      const oldName = resolvedOutlet.name;
      portInfo.name = newName;
      const undo = () => this.renameOutlet(resolvedOutlet, oldName);
      const redo = () => this.renameOutlet(resolvedOutlet, newName);
      this.dispatch('outlet:rename', {
        subject: 'outlet',
        operation: 'rename',
        data: { outlet: resolvedOutlet, name: newName, oldName },
        undo,
        redo,
      });
    }
    return this;
  }

  /**
   * @param {PortSelector} port
   * @param {PortSelector} [beforePort]
   * @returns {EditableChipInfo}
   */
  moveOutlet(port, beforePort) {
    const chipInfo = info(this);
    const resolvedPort = resolveOutlet(chipInfo, port);
    const portInfo = info(resolvedPort);
    if (portInfo.chipInfo !== chipInfo) {
      throw new Error('Port outlet is not owned by chip');
    }
    const list = portInfo.isInput ? chipInfo.inputs : chipInfo.outputs;

    /** @type {PortOutlet | undefined} */
    let resolvedBeforePort;
    if (beforePort !== undefined) {
      resolvedBeforePort = resolveOutlet(chipInfo, beforePort);
      const beforePortInfo = info(resolvedBeforePort);
      if (beforePortInfo.chipInfo !== chipInfo) {
        throw new Error('beforePort outlet is not owned by chip');
      }
      if (beforePortInfo.isInput !== portInfo.isInput) {
        throw new Error('Cannot move outlet across sides (input/output)');
      }
      if (resolvedBeforePort === resolvedPort) {
        return this;
      }
    }

    // Remove from current position
    const idx = list.indexOf(resolvedPort);
    const oldBeforeOutlet = list[idx + 1] ?? null;
    list.splice(idx, 1);

    // Insert before beforePort, or append to end
    if (resolvedBeforePort === undefined) {
      list.push(resolvedPort);
    } else {
      const beforeIdx = list.indexOf(resolvedBeforePort);
      list.splice(beforeIdx, 0, resolvedPort);
    }

    const undo = () =>
      this.moveOutlet(resolvedPort, oldBeforeOutlet ?? undefined);
    const redo = () =>
      this.moveOutlet(resolvedPort, resolvedBeforePort ?? undefined);
    this.dispatch('outlet:move', {
      subject: 'outlet',
      operation: 'move',
      side: portInfo.isInput ? 'input' : 'output',
      kind: portInfo.isFlow ? 'flow' : 'data',
      data: {
        outlet: resolvedPort,
        beforeOutlet: resolvedBeforePort ?? null,
        oldBeforeOutlet,
      },
      undo,
      redo,
    });
    return this;
  }

  /**
   * Removes an outlet and any connections touching it.
   *
   * @param {PortSelector} port
   * @returns {EditableChipInfo}
   */
  removeOutlet(port) {
    const chipInfo = info(this);
    const resolvedPort = resolveOutlet(chipInfo, port);
    const portInfo = info(resolvedPort);
    if (portInfo.chipInfo !== chipInfo) {
      throw new Error('Port outlet is not owned by chip');
    }
    const side = portInfo.isInput ? 'input' : 'output';
    const kind = portInfo.isFlow ? 'flow' : 'data';
    // Collect and remove connections atomically (no individual undo entries)
    const removedConnections = collectConnectionsForPort(chipInfo, portInfo);
    removeConnectionsFromMaps(chipInfo, removedConnections);
    if (removedConnections.length > 0) {
      // Notification-only dispatch (no undo/redo → not recorded)
      this.dispatch('connection:remove', {
        subject: 'connection',
        operation: 'remove',
        data: { connections: removedConnections },
      });
    }
    // Remove from inputs or outputs array
    const list = portInfo.isInput ? chipInfo.inputs : chipInfo.outputs;
    const idx = list.indexOf(resolvedPort);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
    const undo = () => {
      const l = portInfo.isInput ? chipInfo.inputs : chipInfo.outputs;
      l.splice(Math.min(idx, l.length), 0, resolvedPort);
      if (removedConnections.length > 0) {
        addConnectionsToMaps(chipInfo, removedConnections);
        this.dispatch('connection:add', {
          subject: 'connection',
          operation: 'add',
          data: { connections: removedConnections },
        });
      }
      this.dispatch(`outlet:add:${side}:${kind}`, {
        subject: 'outlet',
        operation: 'add',
        side,
        kind,
        data: { outlet: resolvedPort },
      });
    };
    const redo = () => this.removeOutlet(resolvedPort);
    this.dispatch('outlet:remove', {
      subject: 'outlet',
      operation: 'remove',
      side,
      kind,
      data: { outlet: resolvedPort, index: idx },
      undo,
      redo,
    });
    return this;
  }

  /**
   * @param {string} name
   * @returns {EditableChipInfo}
   */
  removeInputOutlet(name) {
    const chipInfo = info(this);
    const port = chipInfo.getInputPortOutlet(name);
    if (!port) {
      throw new Error(`No input outlet named "${name}"`);
    }
    return this.removeOutlet(port);
  }

  /**
   * @param {string} name
   * @returns {EditableChipInfo}
   */
  removeOutputOutlet(name) {
    const chipInfo = info(this);
    const port = chipInfo.getOutputPortOutlet(name);
    if (!port) {
      throw new Error(`No output outlet named "${name}"`);
    }
    return this.removeOutlet(port);
  }

  /**
   * @param {PortSelector} port
   * @param {unknown} newType
   * @returns {EditableChipInfo}
   */
  setOutletType(port, newType) {
    const chipInfo = info(this);
    const resolvedOutlet = resolveOutlet(chipInfo, port);
    if (!(/** @type {EditablePortLike} */ (resolvedOutlet).isData)) {
      throw new Error(
        `Can only set data type for data outlets, got "${String(
          resolvedOutlet,
        )}"`,
      );
    }
    const portInfo = info(resolvedOutlet);
    if (portInfo.chipInfo !== chipInfo) {
      throw new Error('Port outlet is not owned by chip');
    }
    const oldType = portInfo.type;
    portInfo.type = newType !== undefined ? type(newType) : undefined;
    const undo = () => this.setOutletType(resolvedOutlet, oldType);
    const redo = () => this.setOutletType(resolvedOutlet, newType);
    this.dispatch('outlet:type', {
      subject: 'outlet',
      operation: 'type',
      data: {
        outlet: resolvedOutlet,
        type: /** @type {EditablePortLike} */ (resolvedOutlet).type,
        oldType,
      },
      undo,
      redo,
    });
    return this;
  }

  //
  // Ports (of sub-chips)
  //

  /**
   * @param {PortSelector} port
   * @param {unknown} value
   * @returns {EditableChipInfo}
   */
  setPortValue(port, value) {
    const chipInfo = info(this);
    const resolvedPort = resolvePort(chipInfo, port);
    if (!resolvedPort.isData || !resolvedPort.isInput) {
      throw new Error('port is not a data input');
    }
    if (resolvedPort.type && !resolvedPort.type.check(value)) {
      throw new Error(
        `invalid type for default value. expected: ${resolvedPort.type.signature}`,
      );
    }
    const oldValue = resolvedPort.explicitValue;
    resolvedPort.explicitValue = value;
    const undo = () =>
      this.setPortValue(/** @type {PortSelector} */ (resolvedPort), oldValue);
    const redo = () =>
      this.setPortValue(/** @type {PortSelector} */ (resolvedPort), value);
    this.dispatch('port:value', {
      subject: 'port',
      operation: 'value',
      data: { port: resolvedPort, value, oldValue },
      undo,
      redo,
    });
    return this;
  }

  /**
   * @param {PortSelector} port
   * @param {number | string} variadicCount
   * @returns {EditableChipInfo}
   */
  setPortVariadicCount(port, variadicCount) {
    const chipInfo = info(this);
    const resolvedPort = resolvePort(chipInfo, port);
    // Only operate on variadic ports
    if (!resolvedPort.variadic) {
      throw new Error('port is not variadic');
    }
    const oldVariadicCount = Array.from(resolvedPort.variadic).length;
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
        resolvedPort.variadic[i];
      }
    }
    // Disconnect and delete variadic ports atomically (no individual undo entries)
    else {
      const allRemovedConnections = [];
      for (let i = variadicCount; i < oldVariadicCount; i++) {
        const portToRemove = resolvedPort.variadic[i];
        const conns = collectConnectionsForPort(chipInfo, info(portToRemove));
        allRemovedConnections.push(...conns);
        removeConnectionsFromMaps(chipInfo, conns);
        delete resolvedPort.variadic[i];
      }
      if (allRemovedConnections.length > 0) {
        // Notification-only dispatch (no undo/redo → not recorded)
        this.dispatch('connection:remove', {
          subject: 'connection',
          operation: 'remove',
          data: { connections: allRemovedConnections },
        });
      }
    }
    const undo = () =>
      this.setPortVariadicCount(
        /** @type {PortSelector} */ (resolvedPort),
        oldVariadicCount,
      );
    const redo = () =>
      this.setPortVariadicCount(
        /** @type {PortSelector} */ (resolvedPort),
        variadicCount,
      );
    this.dispatch('port:variadicCount', {
      subject: 'port',
      operation: 'variadicCount',
      data: { port: resolvedPort, variadicCount, oldVariadicCount },
      undo,
      redo,
    });
    return this;
  }

  //
  // Single port
  //

  /**
   * @param {string} portName
   * @param {string} code
   * @returns {EditableChipInfo}
   */
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
    const oldExecute = portInfo.execute;
    portInfo.execute = makeFunction(code, outlets);
    const undo = () => {
      portInfo.execute = oldExecute;
      this.dispatch('port:execute', {
        subject: 'port',
        operation: 'execute',
        data: { outlet: portOutlet },
      });
    };
    const redo = () => this.setPortExecute(portName, code);
    this.dispatch('port:execute', {
      subject: 'port',
      operation: 'execute',
      data: { outlet: portOutlet, code },
      undo,
      redo,
    });
    return this;
  }

  /**
   * @param {string} portName
   * @param {string} code
   * @returns {EditableChipInfo}
   */
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
    const oldCompute = portInfo.compute;
    portInfo.compute = makeFunction(code, outlets);
    const undo = () => {
      portInfo.compute = oldCompute;
      this.dispatch('port:compute', {
        subject: 'port',
        operation: 'compute',
        data: { outlet: portOutlet },
      });
    };
    const redo = () => this.setPortCompute(portName, code);
    this.dispatch('port:compute', {
      subject: 'port',
      operation: 'compute',
      data: { outlet: portOutlet, code },
      undo,
      redo,
    });
    return this;
  }

  //
  // Connections
  //

  /**
   * @param {PortSelector} port
   * @returns {boolean}
   */
  hasConnections(port) {
    const chipInfo = info(this);
    return chipInfo.getConnectedPorts(port).length > 0;
  }

  /**
   * @param {ConnectionEndpointSelector} portA
   * @param {ConnectionEndpointSelector} portB
   * @returns {EditableChipInfo}
   */
  probeConnection(portA, portB) {
    // TODO return error if not connectable and order from/to
    // and connections that need removal to allow this
    const chipInfo = info(this);
    chipInfo.addConnection(portA, portB, true);
    return this;
  }

  /**
   * @param {ConnectionEndpointSelector} portA
   * @param {ConnectionEndpointSelector} portB
   * @returns {EditableChipInfo}
   */
  addConnection(portA, portB) {
    const chipInfo = info(this);
    const connection = chipInfo.addConnection(portA, portB, false, true);
    const { source, sink } = connection;
    const undo = () => this.removeConnection(source, sink);
    const redo = () => this.addConnection(source, sink);
    this.dispatch('connection:add', {
      subject: 'connection',
      operation: 'add',
      data: { source, sink },
      undo,
      redo,
    });
    return this;
  }

  /**
   * Removes one or many connections depending on provided endpoints.
   *
   * @param {ConnectionEndpointSelector} portA
   * @param {ConnectionEndpointSelector} [portB]
   * @returns {EditableChipInfo}
   */
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
    // Collect connections before deletion
    const connections = [];
    if (portA) {
      const sinkTarget = chipInfo.sinkConnection.get(portA);
      if (!portB && sinkTarget) {
        connections.push({ source: sinkTarget, sink: portA });
      } else if (portB && sinkTarget === portB) {
        connections.push({ source: portB, sink: portA });
      }
      const aConns = chipInfo.sourceConnections.get(portA);
      if (aConns) {
        if (portB) {
          if (aConns.includes(portB)) {
            connections.push({ source: portA, sink: portB });
          }
        } else {
          for (const otherPort of aConns) {
            connections.push({ source: portA, sink: otherPort });
          }
        }
      }
    }
    if (portB) {
      const sinkTarget = chipInfo.sinkConnection.get(portB);
      if (sinkTarget === portA) {
        if (!connections.some((c) => c.source === portA && c.sink === portB)) {
          connections.push({ source: portA, sink: portB });
        }
      }
      const bConns = chipInfo.sourceConnections.get(portB);
      if (bConns && bConns.includes(portA)) {
        if (!connections.some((c) => c.source === portB && c.sink === portA)) {
          connections.push({ source: portB, sink: portA });
        }
      }
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
    if (!connections || connections.length === 0) {
      this.dispatch('connection:remove', {
        subject: 'connection',
        operation: 'remove',
        data: { connections },
      });
      return this;
    }
    const undo = () => {
      for (const c of connections) {
        try {
          this.addConnection(c.source, c.sink);
        } catch (e) {}
      }
    };
    const redo = () => {
      for (const c of connections) {
        this.removeConnection(c.source, c.sink);
      }
    };
    this.dispatch('connection:remove', {
      subject: 'connection',
      operation: 'remove',
      data: { connections },
      undo,
      redo,
    });
    return this;
  }
}

/**
 * Compiles user-provided code into a function with outlet names in scope.
 *
 * @param {string} code
 * @param {Array<{ name: string }>} outlets
 * @returns {Function}
 */
function makeFunction(code, outlets) {
  const outletsNames = outlets.map((p) => p.name);
  const makeFunc = new Function(...outletsNames, 'return (' + code + ')');
  const res = makeFunc.apply(undefined, outlets);
  return res;
}
