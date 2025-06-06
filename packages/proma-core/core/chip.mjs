import { info, shortUID, assert, assertInfo } from './utils.mjs';
import {
  Port,
  PortList,
  PortOutlet,
  PortInfo,
  InputFlowSourcePortInfo,
  OutputDataSourcePortInfo,
  InputDataSinkPortInfo,
  OutputFlowSinkPortInfo,
  INPUT,
  OUTPUT,
} from './ports.mjs';
import { serializeChipInfo, serializeChipInstance } from './serialize.mjs';
import { PlaceholderChip, PlaceholderPort } from './placeholder.mjs';

//
// Public
//

export class Chip {
  constructor(chipInfo, canonicalValues) {
    let id = chipInfo.makeChipId();
    let customLabel;

    info(this, chipInfo);

    const inputPorts = chipInfo.inputs.map((p) => new Port(this, info(p)));
    const inputs = new PortList(this, inputPorts);
    const ouptutPorts = chipInfo.outputs.map((p) => new Port(this, info(p)));
    const outputs = new PortList(this, ouptutPorts);

    Object.defineProperties(this, {
      id: {
        enumerable: true,
        get() {
          return id;
        },
        set(value) {
          if (typeof value !== 'string') {
            throw new Error('A chip ID must be a string');
          }
          id = value;
        },
      },
      [INPUT]: {
        enumerable: true,
        value: inputs,
      },
      [OUTPUT]: {
        enumerable: true,
        value: outputs,
      },
      isFlowless: {
        get() {
          return chipInfo.isFlowless;
        },
      },
      isDataless: {
        get() {
          return chipInfo.isDataless;
        },
      },
      label: {
        enumerable: true,
        get: () => {
          if (customLabel) return customLabel;
          return chipInfo.makeChipLabel(this);
        },
        set(value) {
          customLabel = value;
        },
      },
      hasCustomLabel: {
        enumerable: true,
        get() {
          return !!customLabel;
        },
      },
    });
    // Assign default values
    if (Array.isArray(canonicalValues) && canonicalValues.length > 0) {
      let i = 0;
      for (const portOutlet of chipInfo.inputs) {
        const portInfo = info(portOutlet);
        if (!portInfo.canonical) {
          continue;
        }
        if (!portInfo.isData) {
          console.warn(
            `Can not set value for port "${portInfo.name}" on chip "${id}"`,
          );
        }
        const port = inputPorts.find((p) => p.name === portInfo.name);
        if (portInfo.isVariadic) {
          // Make sure to generate variadic ports by accessing them
          for (let j = 0, l = canonicalValues.length - i; j < l; j++) {
            port.variadic[j];
          }
          port.explicitValue = canonicalValues.slice(i);
          i = canonicalValues.length;
          break;
        }
        port.explicitValue = canonicalValues[i];
        i++;
      }
      // If canonical values have not been used, we issue a warning
      if (i < canonicalValues.length) {
        throw new Error(
          `Specified ${canonicalValues.length} canonical values but accepting only ${i}`,
        );
      }
    }
  }

  get chipURI() {
    const chipInfo = info(this);
    return chipInfo.URI;
  }

  toJSON(registry) {
    return serializeChipInstance(this, registry || info(this).registry);
  }
}

export function isChipClass(obj) {
  return obj.__proto__ === Chip;
}

//
// Info (private)
//

export class ChipInfo {
  constructor(URI, makeLabel, registry) {
    // TODO validate name, qualifiedName instead?
    this.URI = URI || 'local/' + shortUID();
    this.chips = [];
    this.inputs = [];
    this.outputs = [];
    // If specified, the registry to use to serialize this chip.
    // Serialization may need a registry to produce fully qualified URIs.
    this.registry = registry;
    // Wire map from source -> [sink]. Souces can have multiple sinks.
    // Also forwards PortOutlet sinks to [sinks] by saving their PortOutlet.
    // TODO should map to a Set
    this.sourceConnections = new Map();
    // Wire map from sink -> source. Sink can only have one source.
    // Also forwards PortOutlet source to source by saving their PortOutlet.
    this.sinkConnection = new Map();

    // PlaceholderChip to promises that will replace the placeholder with
    // the actual chip when done
    this.chipLoaders = new Map();

    let idCount = 0;
    // TODO generate JS usable name
    this.makeChipId = () => {
      return `${this.name}_${++idCount}`;
    };

    if (typeof makeLabel === 'function') {
      this.makeChipLabel = makeLabel;
    } else if (typeof makeLabel === 'string') {
      this.makeChipLabel = () => makeLabel;
    } else {
      this.makeChipLabel = (chipInstance) => {
        const parts = this.URI.split('/');
        const lastPart = parts[parts.length - 1];
        const wordsRegExp = /[A-Z][^A-Z\d]+|\d+|[A-Z]+(?![a-z])/g;
        const words = [];
        let wordMatch;
        while ((wordMatch = wordsRegExp.exec(lastPart))) {
          words.push(wordMatch[0].replace(/_/g, '').trim());
        }
        return words.filter((x) => !!x).join(' ');
      };
    }
  }

  // Name given to the javascript entity representing this chip
  // TODO rename to `jsName`
  get name() {
    return this.URI.replace(/[^_$a-z0-9]/gi, '_');
  }

  get isFlowless() {
    if (this.inputFlowPorts.length > 0 || this.outputFlowPorts.length > 0) {
      return false;
    }
    if (this.chips.some((c) => !info(c).isFlowless)) {
      return false;
    }
    return true;
  }

  get isDataless() {
    if (this.inputDataPorts.length > 0 || this.outputDataPorts.length > 0) {
      return false;
    }
    return true;
  }

  //
  // Chips
  //

  getChip(id) {
    if (id instanceof Chip) {
      if (this.chips.includes(id)) {
        return id;
      }
    } else if (typeof id === 'number') {
      return this.chips[id] || null;
    } else if (typeof id === 'string') {
      for (const chip of this.chips) {
        if (chip.id === id) return chip;
      }
    }
    return null;
  }

  addChip(chip) {
    // When addin a placeholder chip, we want to replace it with the resolved
    // chip when loaded. We also need to replace all connections
    if (chip instanceof PlaceholderChip) {
      this.chipLoaders.set(
        chip,
        chip.loadedChipInstance.then((actualChip) => {
          // Account for chip deletion. If deleted we will not replace anything
          // This could happen if an external entity (like edit) removes the
          // placeholder chip before it ends loading
          if (this.chipLoaders.has(chip)) {
            this.replaceChip(chip, actualChip);
            this.chipLoaders.delete(chip);
          }
        }),
      );
    }
    this.chips.push(chip);
  }

  replaceChip(chip, actualChip) {
    assert(actualChip instanceof Chip, 'Expected a Chip instance');
    const chipIndex = this.chips.indexOf(chip);
    this.chips[chipIndex] = actualChip;
    // Replace all connected placeholder ports
    for (const [key, value] of this.sinkConnection.entries()) {
      let replaceKey;
      let replaceValue;
      if (key instanceof PlaceholderPort && key.chip === chip) {
        replaceKey = actualChip[info(key).isInput ? INPUT : OUTPUT][key.name];
        replaceValue = value;
      } else if (value instanceof PlaceholderPort && value.chip === chip) {
        replaceKey = key;
        replaceValue =
          actualChip[info(value).isInput ? INPUT : OUTPUT][value.name];
      }
      if (replaceKey) {
        this.sinkConnection.delete(key);
        this.sinkConnection.set(replaceKey, replaceValue);
      }
    }
    for (const [key, values] of this.sourceConnections.entries()) {
      let replaceKey;
      let replaceValues;
      if (key instanceof PlaceholderPort && key.chip === chip) {
        replaceKey = actualChip[info(key).isInput ? INPUT : OUTPUT][key.name];
        replaceValues = values;
      } else if (
        values.some((v) => v instanceof PlaceholderPort && v.chip === chip)
      ) {
        replaceKey = key;
        replaceValues = values.map((v) => {
          if (v instanceof PlaceholderPort && v.chip === chip) {
            return actualChip[info(v).isInput ? INPUT : OUTPUT][v.name];
          } else {
            return v;
          }
        });
      }
      if (replaceKey) {
        this.sinkConnection.delete(key);
        this.sinkConnection.set(replaceKey, replaceValues);
      }
    }
  }

  //
  // Ports
  //

  getInputPortOutlet(name) {
    for (const port of this.inputs) {
      if (port.name === name) {
        return port;
      }
    }
    return null;
  }

  getOutputPortOutlet(name) {
    for (const port of this.outputs) {
      if (port.name === name) {
        return port;
      }
    }
    return null;
  }

  getPort(path, defaultSide) {
    if (path instanceof Port) {
      if (!this.chips.includes(path.chip)) {
        throw new Error('port is not visible to this Chip');
      }
      return path;
    }
    if (path instanceof PortOutlet) {
      if (!this.inputs.includes(path) && !this.outputs.includes(path)) {
        throw new Error('port is not an outlet of this Chip');
      }
      return path;
    }
    // TODO path could be an Outlet
    if (typeof path === 'string') {
      path = path.split('.');
    }
    let [chipId, side, portName] = path;
    // Case like `in.exec`
    if (typeof portName === 'undefined') {
      portName = side;
      side = chipId;
      chipId = undefined;
    }
    // Case like `exec`, in this case we will try to find a input outlet first
    if (typeof portName === 'undefined') {
      portName = side;
      side = chipId;
      chipId = undefined;
    }
    if (chipId) {
      const chipIndex = /^\$(\d+)$/.exec(chipId);
      if (chipIndex) {
        chipId = parseInt(chipIndex[1]);
      }
      const chip = this.getChip(chipId);
      if (!chip) {
        return null;
      }
      return chip[side][portName];
    }
    if (side === INPUT || (!side && defaultSide === INPUT)) {
      return this.getInputPortOutlet(portName);
    }
    if (side === OUTPUT || (!side && defaultSide === OUTPUT)) {
      return this.getOutputPortOutlet(portName);
    }
    const port1 = this.getInputPortOutlet(portName);
    const port2 = this.getOutputPortOutlet(portName);
    if (port1 && port2) {
      throw new Error(`Ambiguos outlet name "${portName}"`);
    }
    return port1 || port2;
  }

  get inputFlowPorts() {
    return this.inputs.filter((i) => info(i).isFlow);
  }

  get inputDataPorts() {
    return this.inputs.filter((i) => info(i).isData);
  }

  get outputFlowPorts() {
    return this.outputs.filter((i) => info(i).isFlow);
  }

  get outputDataPorts() {
    return this.outputs.filter((i) => info(i).isData);
  }

  // Sources

  addInputFlowPort(name, config) {
    const portInfo = new InputFlowSourcePortInfo(this, name, config);
    portInfo.assertValidName(name, INPUT);
    const portOutlet = new PortOutlet(portInfo);
    this.inputs.push(portOutlet);
    return portOutlet;
  }

  addOutputDataPort(name, config) {
    const portInfo = new OutputDataSourcePortInfo(this, name, config);
    portInfo.assertValidName(name, OUTPUT);
    const portOutlet = new PortOutlet(portInfo);
    this.outputs.push(portOutlet);
    return portOutlet;
  }

  // Sinks

  addOutputFlowPort(name, config) {
    const portInfo = new OutputFlowSinkPortInfo(this, name, config);
    portInfo.assertValidName(name, OUTPUT);
    const portOutlet = new PortOutlet(portInfo);
    this.outputs.push(portOutlet);
    return portOutlet;
  }

  // TODO accept a beforePort param to insert in specific position?
  addInputDataPort(name, config) {
    const portInfo = new InputDataSinkPortInfo(this, name, config);
    portInfo.assertValidName(name, INPUT);
    if (portInfo.isRequired) {
      const otherCanonicalInputs = this.inputs.filter(
        (outlet) => outlet.isData && outlet.isCanonical && !outlet.isRequired,
      );
      if (otherCanonicalInputs.length !== 0) {
        throw new Error(
          `Required canonical inputs must be declared before non-required ones: ${name}`,
        );
      }
    }
    const portOutlet = new PortOutlet(portInfo);
    this.inputs.push(portOutlet);
    return portOutlet;
  }

  //
  // Connections
  //

  addConnection(portA, portB, dryRun, shouldReplace) {
    if (typeof portA === 'string' || Array.isArray(portA)) {
      portA = this.getPort(portA, INPUT);
    }
    if (typeof portB === 'string' || Array.isArray(portB)) {
      portB = this.getPort(portB, OUTPUT);
    }
    if (portA instanceof PortOutlet) {
      portA = info(portA);
    }
    if (portB instanceof PortOutlet) {
      portB = info(portB);
    }
    const isOutletA = portA instanceof PortInfo;
    const isOutletB = portB instanceof PortInfo;
    if (
      !(
        isOutletA ||
        portA instanceof Port ||
        portA instanceof PlaceholderPort
      ) ||
      !(isOutletB || portB instanceof Port || portB instanceof PlaceholderPort)
    ) {
      throw new Error(
        `Must have two ports or outlet pair. ${portA && portA.name} -> ${
          portB && portB.name
        }`,
      );
    }
    if (
      !(isOutletA || this.chips.includes(portA.chip)) ||
      !(isOutletB || this.chips.includes(portB.chip))
    ) {
      throw new Error('Both ports must be in the chip body');
    }
    const infoA = isOutletA ? portA : info(portA);
    const infoB = isOutletB ? portB : info(portB);
    if (infoA.isFlow !== infoB.isFlow) {
      if (portA instanceof PlaceholderPort) {
        infoA.isFlow = infoB.isFlow;
        infoA.isData = infoB.isData;
      } else if (portB instanceof PlaceholderPort) {
        infoB.isFlow = infoA.isFlow;
        infoB.isData = infoA.isData;
      } else {
        throw new Error('Can not wire flow port with data port');
      }
    }
    if ((isOutletA ^ infoA.isInput) === (isOutletB ^ infoB.isInput)) {
      throw new Error('Can not wire ports of the same input/output side');
    }
    let source, sink;
    if (infoA.isSource ^ isOutletA) {
      source = portA;
      sink = portB;
    } else {
      source = portB;
      sink = portA;
    }
    if (sink.isData && sink.isConceiled) {
      throw new Error(`Can not connect to conceiled port "${sink.fullName}"`);
    }
    if (source.isData && source.isConceiled) {
      throw new Error(`Can not connect to conceiled port "${source.fullName}"`);
    }
    if (source.type && sink.type && !source.type.match(sink.type)) {
      throw new Error(
        `Invalid types: ${source.fullName} (${source.type.signature}) -> ${sink.fullName} (${sink.type.signature})`,
      );
    }
    if (this.sinkConnection.has(sink)) {
      if (!shouldReplace) {
        throw new Error('Sink port already connected');
      }
      // Replace existing connection
      if (!dryRun) {
        const sinks = this.sourceConnections.get(this.sinkConnection.get(sink));
        if (sinks) {
          sinks.splice(sinks.indexOf(sink), 1);
        }
      }
    }
    if (!dryRun) {
      const sinks = this.sourceConnections.get(source) || [];
      sinks.push(sink);
      this.sourceConnections.set(source, sinks);
      this.sinkConnection.set(sink, source);

      // When connecting and output port in a non-pure chip (aka a
      // chip with output flow defined), we automatically add all output
      // flows declared before the output data as its `computeOn`.
      // This allow for a shortcut syntax where you don't need
      // to specify output flow ports to compute this output data port on.
      if (
        sink instanceof OutputDataSourcePortInfo &&
        (!sink.computeOn || sink.computeOn.length === 0)
      ) {
        const computeOn = this.outputs
          .slice(0, this.outputs.indexOf(sink))
          .map((i) => info(i))
          .filter((i) => i.isFlow);
        sink.computeOn = computeOn;
      }
    }
    return {
      source,
      sink,
    };
  }

  getConnectedPorts(port, chipInstance) {
    let portInfo;
    if (port instanceof Port) {
      portInfo = info(port);
    } else if (port instanceof PortOutlet) {
      portInfo = info(port);
      port = null;
    } else if (port instanceof PortInfo) {
      portInfo = port;
      port = null;
    } else {
      throw new Error('Can only get connections from a port');
    }
    let conn;
    if (portInfo.isSource) {
      if (port) {
        conn = this.sourceConnections.get(port);
      }
      // Search outlets
      if (!conn) {
        conn = this.sinkConnection.get(portInfo);
      }
    } else {
      if (port) {
        conn = this.sinkConnection.get(port);
      }
      // Search outlets
      if (!conn) {
        conn = this.sourceConnections.get(portInfo);
      }
    }
    if (!conn) return [];
    conn = Array.isArray(conn) ? conn : [conn];
    // Resolve outlets if a chipInstance is specified
    if (chipInstance) {
      assertInfo(chipInstance, this);
      const res = [];
      for (const outletInfo of conn) {
        if (outletInfo instanceof PortInfo) {
          const parentPort =
            chipInstance[outletInfo.isInput ? INPUT : OUTPUT][outletInfo.name];
          if (info(parentPort) !== outletInfo) {
            throw new Error('Invalid port found in given parent');
          }
          res.push(parentPort);
        } else {
          res.push(outletInfo);
        }
      }
      conn = res;
    }
    return conn;
  }

  //
  // Loaded
  //

  get isLoaded() {
    return this.chips.filter((c) => !(c instanceof Chip)).length === 0;
  }

  get loaded() {
    return Promise.all(this.chipLoaders.values()).then(() => true);
  }

  //
  // Serialization
  //

  toJSON(registry) {
    return serializeChipInfo(this, registry || this.registry);
  }
}
