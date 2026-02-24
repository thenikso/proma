import { info } from './utils.mjs';
import { PortOutlet } from './ports.mjs';

export class EditHistory {
  constructor(editor) {
    this._editor = editor;
    this._undoStack = [];
    this._redoStack = [];
    this._groupStack = [];
    this._inGroup = false;
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
    command.undo();
    this._redoStack.push(command);
    return this;
  }

  redo() {
    if (!this.canRedo) return this;
    const command = this._redoStack.pop();
    command.execute();
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
    // Clear redo stack when a new command is recorded
    this._redoStack = [];
    if (this._inGroup && this._groupStack.length > 0) {
      this._groupStack[this._groupStack.length - 1].push(command);
    } else {
      this._undoStack.push(command);
    }
    return this;
  }
}

/**
 * Wraps an editor instance with undo/redo history tracking.
 * Returns a proxy that intercepts edit method calls and records
 * inverse commands for undo/redo.
 *
 * @param {object} editor - An EditableChipInfo instance
 * @returns {object} - A proxy around the editor with history support
 */
export function withHistory(editor) {
  const history = new EditHistory(editor);

  // Helper to get all connections involving a port or chip
  function getConnectionsForPort(port) {
    const chipInfo = info(editor);
    const connections = [];
    for (const [sink, source] of chipInfo.sinkConnection.entries()) {
      if (sink === port || source === port ||
          (sink instanceof PortOutlet && info(sink) === port) ||
          (source instanceof PortOutlet && info(source) === port)) {
        connections.push({ source, sink });
      }
    }
    return connections;
  }

  function getConnectionsForChip(chip) {
    const chipInfo = info(editor);
    const connections = [];
    for (const [sink, source] of chipInfo.sinkConnection.entries()) {
      const sinkChip = sink instanceof PortOutlet ? null : sink.chip;
      const sourceChip = source instanceof PortOutlet ? null : source.chip;
      if (sinkChip === chip || sourceChip === chip) {
        connections.push({ source, sink });
      }
    }
    return connections;
  }

  // Intercept specific methods on the editor
  const methods = {
    addChip(...args) {
      let addedChip = null;
      const onAdd = (event) => {
        addedChip = event.detail.chip;
      };
      editor.on('chip:add', onAdd);
      editor.addChip(...args);
      editor.off('chip:add', onAdd);

      if (addedChip) {
        const chip = addedChip;
        history._record({
          description: 'addChip',
          execute() {
            // Re-add chip for redo
            const chipInfoOuter = info(editor);
            chipInfoOuter.addChip(chip);
            editor.dispatch('chip:add', {
              subject: 'chip',
              operation: 'add',
              chip,
            });
          },
          undo() {
            editor.removeChip(chip);
          },
        });
      }
      return proxy;
    },

    removeChip(chip) {
      const chipInfo = info(editor);
      if (typeof chip === 'string') {
        chip = chipInfo.getChip(chip);
      }
      if (!chip) {
        editor.removeChip(chip);
        return proxy;
      }

      // Capture chip state before removal
      const chipToRemove = chip;
      const chipId = chip.id;
      const connectionsToRestore = getConnectionsForChip(chip);

      // Capture port values for input data ports
      const portValues = [];
      const chipInfoInner = info(chip);
      if (chipInfoInner) {
        for (const portOutlet of chipInfoInner.inputs) {
          const portInfo = info(portOutlet);
          if (portInfo.isData) {
            // Find the corresponding port instance on the chip
            const portInstance = chip['in'][portOutlet.name];
            if (portInstance && portInstance.explicitValue !== undefined) {
              portValues.push({ portName: portOutlet.name, value: portInstance.explicitValue });
            }
          }
        }
      }

      editor.removeChip(chip);

      history._record({
        description: 'removeChip',
        execute() {
          editor.removeChip(chipToRemove);
        },
        undo() {
          // Re-add the chip
          const chipInfoOuter = info(editor);
          chipInfoOuter.addChip(chipToRemove);
          // Restore the chip id if it changed
          if (chipToRemove.id !== chipId) {
            chipToRemove.id = chipId;
          }
          editor.dispatch('chip:add', {
            subject: 'chip',
            operation: 'add',
            chip: chipToRemove,
          });
          // Restore connections
          for (const conn of connectionsToRestore) {
            try {
              editor.addConnection(conn.source, conn.sink);
            } catch (e) {
              // Connection may already exist or be invalid, skip
            }
          }
          // Restore port values
          for (const { portName, value } of portValues) {
            try {
              const portInstance = chipToRemove['in'][portName];
              if (portInstance) {
                portInstance.explicitValue = value;
              }
            } catch (e) {
              // ignore
            }
          }
        },
      });
      return proxy;
    },

    setChipId(chip, id, dryRun) {
      let oldId = null;
      const onId = (event) => {
        oldId = event.detail.oldId;
      };
      editor.on('chip:id', onId);
      editor.setChipId(chip, id, dryRun);
      editor.off('chip:id', onId);

      if (oldId !== null && !dryRun) {
        const chipRef = typeof chip === 'string' ? info(editor).getChip(id) : chip;
        const capturedOldId = oldId;
        const capturedNewId = id;
        history._record({
          description: 'setChipId',
          execute() {
            editor.setChipId(chipRef, capturedNewId);
          },
          undo() {
            editor.setChipId(chipRef, capturedOldId);
          },
        });
      }
      return proxy;
    },

    moveOutlet(port, beforePort) {
      const chipInfo = info(editor);

      // Resolve port before the call so we can capture its current position
      let resolvedPort = port;
      if (typeof resolvedPort === 'string') {
        resolvedPort = chipInfo.getPort(resolvedPort);
      }

      // Capture old "before": the element right after port in its list
      let oldBeforeOutlet = undefined;
      if (resolvedPort instanceof PortOutlet) {
        const portInfo = info(resolvedPort);
        const list = portInfo.isInput ? chipInfo.inputs : chipInfo.outputs;
        const currentIdx = list.indexOf(resolvedPort);
        oldBeforeOutlet = list[currentIdx + 1];
      }

      // Resolve beforePort reference
      let resolvedBefore = beforePort;
      if (typeof resolvedBefore === 'string') {
        resolvedBefore = chipInfo.getPort(resolvedBefore);
      }

      editor.moveOutlet(port, beforePort);

      const capturedPort = resolvedPort;
      const capturedBefore = resolvedBefore;
      const capturedOldBefore = oldBeforeOutlet;
      history._record({
        description: 'moveOutlet',
        execute() {
          editor.moveOutlet(capturedPort, capturedBefore);
        },
        undo() {
          editor.moveOutlet(capturedPort, capturedOldBefore);
        },
      });
      return proxy;
    },

    renameOutlet(outlet, newName, dryRun) {
      let oldName = null;
      const onRename = (event) => {
        oldName = event.detail.oldName;
      };
      editor.on('outlet:rename', onRename);
      editor.renameOutlet(outlet, newName, dryRun);
      editor.off('outlet:rename', onRename);

      if (oldName !== null && !dryRun) {
        const chipInfo = info(editor);
        // Resolve the outlet reference after rename
        const outletRef = chipInfo.getPort(newName);
        const capturedOldName = oldName;
        const capturedNewName = newName;
        history._record({
          description: 'renameOutlet',
          execute() {
            editor.renameOutlet(outletRef, capturedNewName);
          },
          undo() {
            editor.renameOutlet(outletRef, capturedOldName);
          },
        });
      }
      return proxy;
    },

    addConnection(portA, portB) {
      let capturedSource = null;
      let capturedSink = null;
      const onAdd = (event) => {
        capturedSource = event.detail.source;
        capturedSink = event.detail.sink;
      };
      editor.on('connection:add', onAdd);
      editor.addConnection(portA, portB);
      editor.off('connection:add', onAdd);

      if (capturedSource !== null) {
        const source = capturedSource;
        const sink = capturedSink;
        history._record({
          description: 'addConnection',
          execute() {
            editor.addConnection(source, sink);
          },
          undo() {
            editor.removeConnection(source, sink);
          },
        });
      }
      return proxy;
    },

    removeConnection(portA, portB) {
      // Capture the connections before removal
      const chipInfo = info(editor);
      let removedConnections = [];

      if (portA instanceof PortOutlet) {
        removedConnections = getConnectionsForPort(info(portA));
      } else if (portA) {
        removedConnections = getConnectionsForPort(portA);
      }

      editor.removeConnection(portA, portB);

      if (removedConnections.length > 0) {
        const connections = removedConnections.slice();
        history._record({
          description: 'removeConnection',
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
                // Connection may already exist, skip
              }
            }
          },
        });
      }
      return proxy;
    },

    setPortValue(port, value) {
      let oldValue = undefined;
      let capturedPort = null;
      const onValue = (event) => {
        oldValue = event.detail.oldValue;
        capturedPort = event.detail.port;
      };
      editor.on('port:value', onValue);
      editor.setPortValue(port, value);
      editor.off('port:value', onValue);

      if (capturedPort !== null) {
        const portRef = capturedPort;
        const capturedOldValue = oldValue;
        const capturedNewValue = value;
        history._record({
          description: 'setPortValue',
          execute() {
            editor.setPortValue(portRef, capturedNewValue);
          },
          undo() {
            editor.setPortValue(portRef, capturedOldValue);
          },
        });
      }
      return proxy;
    },

    setPortVariadicCount(port, variadicCount) {
      let oldVariadicCount = undefined;
      let capturedPort = null;
      const onCount = (event) => {
        oldVariadicCount = event.detail.oldVariadicCount;
        capturedPort = event.detail.port;
      };
      editor.on('port:variadicCount', onCount);
      editor.setPortVariadicCount(port, variadicCount);
      editor.off('port:variadicCount', onCount);

      if (capturedPort !== null) {
        const portRef = capturedPort;
        const capturedOld = oldVariadicCount;
        const capturedNew = typeof variadicCount === 'string'
          ? capturedOld + parseInt(variadicCount)
          : variadicCount;
        history._record({
          description: 'setPortVariadicCount',
          execute() {
            editor.setPortVariadicCount(portRef, capturedNew);
          },
          undo() {
            editor.setPortVariadicCount(portRef, capturedOld);
          },
        });
      }
      return proxy;
    },

    addInputFlowOutlet(name, config) {
      let addedOutlet = null;
      const onAdd = (event) => {
        addedOutlet = event.detail.outlet;
      };
      editor.on('outlet:add:input:flow', onAdd);
      editor.addInputFlowOutlet(name, config);
      editor.off('outlet:add:input:flow', onAdd);

      if (addedOutlet) {
        const outlet = addedOutlet;
        history._record({
          description: 'addInputFlowOutlet',
          execute() {
            // redo: re-add the outlet
          },
          undo() {
            editor.removeOutlet(outlet);
          },
        });
      }
      return proxy;
    },

    addInputDataOutlet(name, config) {
      let addedOutlet = null;
      const onAdd = (event) => {
        addedOutlet = event.detail.outlet;
      };
      editor.on('outlet:add:input:data', onAdd);
      editor.addInputDataOutlet(name, config);
      editor.off('outlet:add:input:data', onAdd);

      if (addedOutlet) {
        const outlet = addedOutlet;
        history._record({
          description: 'addInputDataOutlet',
          execute() {
            // redo: re-add the outlet
          },
          undo() {
            editor.removeOutlet(outlet);
          },
        });
      }
      return proxy;
    },

    addOutputFlowOutlet(name) {
      let addedOutlet = null;
      const onAdd = (event) => {
        addedOutlet = event.detail.outlet;
      };
      editor.on('outlet:add:output:flow', onAdd);
      editor.addOutputFlowOutlet(name);
      editor.off('outlet:add:output:flow', onAdd);

      if (addedOutlet) {
        const outlet = addedOutlet;
        history._record({
          description: 'addOutputFlowOutlet',
          execute() {
            // redo: re-add the outlet
          },
          undo() {
            editor.removeOutlet(outlet);
          },
        });
      }
      return proxy;
    },

    addOutputDataOutlet(name, config) {
      let addedOutlet = null;
      const onAdd = (event) => {
        addedOutlet = event.detail.outlet;
      };
      editor.on('outlet:add:output:data', onAdd);
      editor.addOutputDataOutlet(name, config);
      editor.off('outlet:add:output:data', onAdd);

      if (addedOutlet) {
        const outlet = addedOutlet;
        history._record({
          description: 'addOutputDataOutlet',
          execute() {
            // redo: re-add the outlet
          },
          undo() {
            editor.removeOutlet(outlet);
          },
        });
      }
      return proxy;
    },
  };

  const proxy = new Proxy(editor, {
    get(target, key) {
      if (key === 'undo') return () => { history.undo(); return proxy; };
      if (key === 'redo') return () => { history.redo(); return proxy; };
      if (key === 'canUndo') return history.canUndo;
      if (key === 'canRedo') return history.canRedo;
      if (key === 'history') return history;
      if (key in methods) return methods[key];
      // Non-configurable data properties (like `Chip`) must be returned as-is;
      // wrapping them in a function violates the proxy invariant.
      const desc = Object.getOwnPropertyDescriptor(target, key);
      if (desc && !desc.configurable && !desc.writable) return desc.value;
      const value = target[key];
      if (typeof value === 'function') {
        return (...args) => {
          const result = value.apply(target, args);
          // If the original method returns `this` (the editor), return proxy instead
          if (result === target) return proxy;
          return result;
        };
      }
      return value;
    },
  });

  return proxy;
}
