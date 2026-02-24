import { info } from './utils.mjs';
import { PortOutlet } from './ports.mjs';

export class EditHistory {
  constructor(editor) {
    this._editor = editor;
    this._undoStack = [];
    this._redoStack = [];
    this._groupStack = [];
    this._inGroup = false;
    this._replaying = false;
  }

  get canUndo() {
    return this._undoStack.length > 0;
  }

  get canRedo() {
    return this._redoStack.length > 0;
  }

  get undoCount() {
    return this._undoStack.length;
  }

  get redoCount() {
    return this._redoStack.length;
  }

  undo() {
    if (!this.canUndo) return this;
    const command = this._undoStack.pop();
    this._replaying = true;
    try {
      command.undo();
    } finally {
      this._replaying = false;
    }
    this._redoStack.push(command);
    return this;
  }

  redo() {
    if (!this.canRedo) return this;
    const command = this._redoStack.pop();
    this._replaying = true;
    try {
      command.execute();
    } finally {
      this._replaying = false;
    }
    this._undoStack.push(command);
    return this;
  }

  clear() {
    this._undoStack = [];
    this._redoStack = [];
    this._groupStack = [];
    this._inGroup = false;
    return this;
  }

  beginGroup() {
    this._inGroup = true;
    this._groupStack.push([]);
    return this;
  }

  endGroup() {
    if (!this._inGroup || this._groupStack.length === 0) return this;
    const commands = this._groupStack.pop();
    if (this._groupStack.length === 0) {
      this._inGroup = false;
    }
    if (commands.length === 0) return this;
    const groupCommand = {
      description: 'group',
      execute() {
        for (const cmd of commands) {
          cmd.execute();
        }
      },
      undo() {
        for (let i = commands.length - 1; i >= 0; i--) {
          commands[i].undo();
        }
      },
    };
    this._record(groupCommand);
    return this;
  }

  _record(command) {
    // Only clear redo stack when not inside a group (endGroup handles it for the outer)
    if (!this._inGroup) {
      this._redoStack = [];
    }
    if (this._inGroup && this._groupStack.length > 0) {
      this._groupStack[this._groupStack.length - 1].push(command);
    } else {
      this._undoStack.push(command);
    }
    return this;
  }
}

// Methods that trigger auto-grouping (wrap in beginGroup/endGroup so
// multi-event operations become one undo entry).
const GROUPED_METHODS = new Set([
  'addChip',
  'removeChip',
  'addInputFlowOutlet',
  'addInputDataOutlet',
  'addOutputFlowOutlet',
  'addOutputDataOutlet',
  'removeOutlet',
  'removeInputOutlet',
  'removeOutputOutlet',
  'moveOutlet',
  'renameOutlet',
  'setChipId',
  'setChipLabel',
  'setOutletType',
  'addConnection',
  'removeConnection',
  'setPortValue',
  'setPortVariadicCount',
]);

/**
 * Wraps an editor instance with undo/redo history tracking.
 * Uses an event-driven approach: listens to editor events and builds
 * undo/redo commands from event details automatically.
 *
 * @param {object} editor - An EditableChipInfo instance
 * @returns {object} - A proxy around the editor with history support
 */
export function withHistory(editor) {
  const history = new EditHistory(editor);

  // Event → command builder map
  const eventCommandBuilders = {
    'chip:add'(detail) {
      const { chip } = detail;
      return {
        description: 'chip:add',
        execute() {
          const chipInfoOuter = info(editor);
          chipInfoOuter.addChip(chip);
          editor.dispatch('chip:add', { subject: 'chip', operation: 'add', chip });
        },
        undo() {
          editor.removeChip(chip);
        },
      };
    },

    'chip:remove'(detail) {
      const { chip, connections, portValues } = detail;
      return {
        description: 'chip:remove',
        execute() {
          editor.removeChip(chip);
        },
        undo() {
          const chipInfoOuter = info(editor);
          chipInfoOuter.addChip(chip);
          editor.dispatch('chip:add', { subject: 'chip', operation: 'add', chip });
          // Restore connections
          for (const conn of (connections || [])) {
            try {
              editor.addConnection(conn.source, conn.sink);
            } catch (e) {
              // skip invalid
            }
          }
          // Restore port values
          for (const { portName, value } of (portValues || [])) {
            try {
              const portInstance = chip['in'][portName];
              if (portInstance) portInstance.explicitValue = value;
            } catch (e) {
              // ignore
            }
          }
        },
      };
    },

    'chip:id'(detail) {
      const { chip, id, oldId } = detail;
      return {
        description: 'chip:id',
        execute() { editor.setChipId(chip, id); },
        undo() { editor.setChipId(chip, oldId); },
      };
    },

    'chip:label'(detail) {
      const { chip, label, oldLabel } = detail;
      return {
        description: 'chip:label',
        execute() { editor.setChipLabel(chip, label); },
        undo() { editor.setChipLabel(chip, oldLabel); },
      };
    },

    'outlet:add:input:flow'(detail) {
      const { outlet } = detail;
      return {
        description: 'outlet:add:input:flow',
        execute() {
          const chipInfoOuter = info(editor);
          chipInfoOuter.inputs.push(outlet);
          editor.dispatch('outlet:add:input:flow', {
            subject: 'outlet', operation: 'add', side: 'input', kind: 'flow', outlet,
          });
        },
        undo() { editor.removeOutlet(outlet); },
      };
    },

    'outlet:add:input:data'(detail) {
      const { outlet } = detail;
      return {
        description: 'outlet:add:input:data',
        execute() {
          const chipInfoOuter = info(editor);
          chipInfoOuter.inputs.push(outlet);
          editor.dispatch('outlet:add:input:data', {
            subject: 'outlet', operation: 'add', side: 'input', kind: 'data', outlet,
          });
        },
        undo() { editor.removeOutlet(outlet); },
      };
    },

    'outlet:add:output:flow'(detail) {
      const { outlet } = detail;
      return {
        description: 'outlet:add:output:flow',
        execute() {
          const chipInfoOuter = info(editor);
          chipInfoOuter.outputs.push(outlet);
          editor.dispatch('outlet:add:output:flow', {
            subject: 'outlet', operation: 'add', side: 'output', kind: 'flow', outlet,
          });
        },
        undo() { editor.removeOutlet(outlet); },
      };
    },

    'outlet:add:output:data'(detail) {
      const { outlet } = detail;
      return {
        description: 'outlet:add:output:data',
        execute() {
          const chipInfoOuter = info(editor);
          chipInfoOuter.outputs.push(outlet);
          editor.dispatch('outlet:add:output:data', {
            subject: 'outlet', operation: 'add', side: 'output', kind: 'data', outlet,
          });
        },
        undo() { editor.removeOutlet(outlet); },
      };
    },

    'outlet:remove'(detail) {
      const { outlet, index, side, kind } = detail;
      return {
        description: 'outlet:remove',
        execute() { editor.removeOutlet(outlet); },
        undo() {
          const chipInfoOuter = info(editor);
          const list = side === 'input' ? chipInfoOuter.inputs : chipInfoOuter.outputs;
          const insertAt = Math.min(index, list.length);
          list.splice(insertAt, 0, outlet);
          const eventName = `outlet:add:${side}:${kind}`;
          editor.dispatch(eventName, {
            subject: 'outlet', operation: 'add', side, kind, outlet,
          });
        },
      };
    },

    'outlet:rename'(detail) {
      const { outlet, name, oldName } = detail;
      return {
        description: 'outlet:rename',
        execute() { editor.renameOutlet(outlet, name); },
        undo() { editor.renameOutlet(outlet, oldName); },
      };
    },

    'outlet:move'(detail) {
      const { outlet, beforeOutlet, oldBeforeOutlet } = detail;
      return {
        description: 'outlet:move',
        execute() { editor.moveOutlet(outlet, beforeOutlet ?? undefined); },
        undo() { editor.moveOutlet(outlet, oldBeforeOutlet ?? undefined); },
      };
    },

    'outlet:type'(detail) {
      const { outlet, type, oldType } = detail;
      return {
        description: 'outlet:type',
        execute() { editor.setOutletType(outlet, type); },
        undo() { editor.setOutletType(outlet, oldType); },
      };
    },

    'connection:add'(detail) {
      const { source, sink } = detail;
      return {
        description: 'connection:add',
        execute() { editor.addConnection(source, sink); },
        undo() { editor.removeConnection(source, sink); },
      };
    },

    'connection:remove'(detail) {
      const { connections } = detail;
      if (!connections || connections.length === 0) return null;
      return {
        description: 'connection:remove',
        execute() {
          for (const conn of connections) {
            editor.removeConnection(conn.source, conn.sink);
          }
        },
        undo() {
          for (const conn of connections) {
            try {
              editor.addConnection(conn.source, conn.sink);
            } catch (e) {
              // skip
            }
          }
        },
      };
    },

    'port:value'(detail) {
      const { port, value, oldValue } = detail;
      return {
        description: 'port:value',
        execute() { editor.setPortValue(port, value); },
        undo() { editor.setPortValue(port, oldValue); },
      };
    },

    'port:variadicCount'(detail) {
      const { port, variadicCount, oldVariadicCount } = detail;
      return {
        description: 'port:variadicCount',
        execute() { editor.setPortVariadicCount(port, variadicCount); },
        undo() { editor.setPortVariadicCount(port, oldVariadicCount); },
      };
    },
  };

  // Listen to all events and record commands
  editor.on('*', (event) => {
    if (history._replaying) return;
    const builder = eventCommandBuilders[event.type];
    if (!builder) return;
    const command = builder(event.detail);
    if (command) {
      history._record(command);
    }
  });

  const proxy = new Proxy(editor, {
    get(target, key) {
      if (key === 'undo') return () => { history.undo(); return proxy; };
      if (key === 'redo') return () => { history.redo(); return proxy; };
      if (key === 'canUndo') return history.canUndo;
      if (key === 'canRedo') return history.canRedo;
      if (key === 'history') return history;
      // Non-configurable data properties (like `Chip`) must be returned as-is
      const desc = Object.getOwnPropertyDescriptor(target, key);
      if (desc && !desc.configurable && !desc.writable) return desc.value;
      const value = target[key];
      if (typeof value !== 'function') return value;
      if (GROUPED_METHODS.has(key)) {
        return (...args) => {
          history.beginGroup();
          try {
            const result = value.apply(target, args);
            return result === target ? proxy : result;
          } finally {
            history.endGroup();
          }
        };
      }
      return (...args) => {
        const result = value.apply(target, args);
        return result === target ? proxy : result;
      };
    },
  });

  return proxy;
}
