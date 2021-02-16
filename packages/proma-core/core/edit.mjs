import { info, context, assert } from './utils.mjs';
import { Chip, ChipInfo } from './chip.mjs';

export function editable(chip) {
  assert(chip instanceof Chip, 'Can only make Chip editable');
  return new EditableChip(chip);
}

class EditableChip {
  constructor(chip) {
    this.chip = chip;

    //
    // Events
    //
    const events = new Map();
    Object.defineProperties({
      on: {
        value: function on(eventName, listener) {
          const listeners = events.get(eventName) || new Set();
          listeners.add(listener);
          events.set(eventName, listeners);
        },
      },
      off: {
        value: function off(eventName, listener) {
          if (typeof eventName === 'undefined') {
            events.clear();
            return;
          }
          if (typeof listener === 'undefined') {
            listener.delete(eventName);
            return;
          }
          const listeners = events.get(eventName);
          if (listeners) {
            listeners.delete(listener);
          }
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
  // Wrappers for ChipInfo api
  //

  addChip(chipToAdd) {
    if (this.dispatch('chip:add', { operation: 'add', chip: chipToAdd })) {
      const chipInfo = info(this.chip);
      chipInfo.addChip(chipToAdd);
    }
  }

  addInputFlowPort(name, config) {}
  addInputDataPort(name, config) {}
  addOutputFlowPort(name, config) {}
  addOutputDataPort(name, config) {}

  addConnection(portA, portB) {}

  //
  // Edit only api
  //

  removeChip(chip) {}

  removePort(port) {}
  removeInputPort(name) {}
  removeOutputPort(name) {}
  movePort(port, beforePort) {}

  removeConnection(portA, portB) {}

  //
  // Builder api
  //

  edit(build) {
    context.push(this);
    build.call();
    context.pop();
  }
}

// export function removeInput(name) {}
// export function removeOutput(name) {}
// export function removeChip(id) {}
