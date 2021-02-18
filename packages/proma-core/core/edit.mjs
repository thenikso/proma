import { info } from './utils.mjs';

export class EditableChipInfo {
  constructor(chipClass, chipInfo) {
    info(this, chipInfo);

    const self = this;

    //
    // Return class
    //
    Object.defineProperty(this, 'chip', {
      enumerable: true,
      value: chipClass,
    });

    //
    // Events
    //
    const events = new Map();
    Object.defineProperties(this, {
      on: {
        value: function on(eventName, listener) {
          const listeners = events.get(eventName) || new Set();
          listeners.add(listener);
          events.set(eventName, listeners);
          return self;
        },
      },
      off: {
        value: function off(eventName, listener) {
          if (typeof eventName === 'undefined') {
            events.clear();
            return self;
          }
          if (typeof listener === 'undefined') {
            listener.delete(eventName);
            return self;
          }
          const listeners = events.get(eventName);
          if (listeners) {
            listeners.delete(listener);
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

  // TODO the registry should provide a functionality to show which chips
  // can be added

  addChip(chipToAdd) {
    const chipInfo = info(this);
    chipInfo.addChip(chipToAdd);
    this.dispatch('chip:add', {
      subject: 'chip',
      operation: 'add',
      add: chipToAdd,
    });
    return this;
  }

  removeChip(chip) {}

  //
  // Ports
  //

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

  removePort(port) {}
  removeInputPort(name) {}
  removeOutputPort(name) {}
  movePort(port, beforePort) {}

  //
  // Connections
  //

  probeConnection(portA, portB) {
    // TODO return error if not connectable and order from/to
    // and connections that need removal to allow this
  }

  addConnection(portA, portB) {
    const chipInfo = info(this);
    const connection = chipInfo.addConnection(portA, portB);
    this.dispatch('connection:add', {
      subject: 'connection',
      operation: 'add',
      ...connection,
    });
    return this;
  }

  // TODO rememeber to disable ingress?
  removeConnection(portA, portB) {}
}
