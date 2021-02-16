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
} from './ports.mjs';
import { Compilation } from './compile.mjs';

export class Chip {
  constructor(chipInfo, canonicalValues) {
    let id = chipInfo.makeChipId();

    info(this, chipInfo);

    const inputs = new PortList(this, chipInfo.inputs);
    const outputs = new PortList(this, chipInfo.outputs);

    Object.defineProperties(this, {
      id: {
        enumerable: true,
        get() {
          return id;
        },
        set(value) {
          id = value;
        },
      },
      in: {
        enumerable: true,
        value: inputs,
      },
      out: {
        enumerable: true,
        value: outputs,
      },
      type: {
        enumerable: true,
        value: chipInfo.name,
      },
      toJS: {
        value: (wrapper) => {
          const compilation = new Compilation(this);
          return compilation.compile(wrapper);
        },
      },
    });
    // Assign default values
    if (Array.isArray(canonicalValues) && canonicalValues.length > 0) {
      let i = 0;
      for (const portInfo of chipInfo.inputs) {
        if (!portInfo.canonical) {
          continue;
        }
        if (!portInfo.isData) {
          console.warn(
            `Can not set value for port "${portInfo.name}" on chip "${id}"`,
          );
        }
        if (portInfo.isVariadic) {
          this.in[portInfo.name] = canonicalValues.slice(i);
          break;
        }
        this.in[portInfo.name] = canonicalValues[i];
        i++;
      }
    }
  }
}

export class ChipInfo {
  constructor(name) {
    this.name = name || shortUID();
    this.chips = [];
    this.inputs = [];
    this.outputs = [];
    // Wire map from source -> [sink]. Souces can have multiple sinks.
    // Also forwards PortOutlet sinks to [sinks] by saving their PortInfo.
    this.sourceConnections = new Map();
    // Wire map from sink -> source. Sink can only have one source.
    // Also forwards PortOutlet source to source by saving their PortInfo.
    this.sinkConnection = new Map();

    let idCount = 0;
    this.makeChipId = () => {
      return `${this.name}_${++idCount}`;
    };
  }

  get isPure() {
    if (this.inputFlowPorts.length > 0 || this.outputFlowPorts.length > 0) {
      return false;
    }
    if (this.chips.some((c) => !info(c).isPure)) {
      return false;
    }
    return true;
  }

  //
  // Chips
  //

  addChip(chip) {
    this.chips.push(chip);
  }

  //
  // Ports
  //

  getInputPortInfo(name) {
    for (const port of this.inputs) {
      if (port.name === name) {
        return port;
      }
    }
    return null;
  }

  getOutputPortInfo(name) {
    for (const port of this.outputs) {
      if (port.name === name) {
        return port;
      }
    }
    return null;
  }

  get inputFlowPorts() {
    return this.inputs.filter((i) => i.isFlow);
  }

  get inputDataPorts() {
    return this.inputs.filter((i) => i.isData);
  }

  get outputFlowPorts() {
    return this.outputs.filter((i) => i.isFlow);
  }

  get outputDataPorts() {
    return this.outputs.filter((i) => i.isData);
  }

  // Sources

  addInputFlowPort(name, config) {
    const portInfo = new InputFlowSourcePortInfo(this, name, config);
    this.inputs.push(portInfo);
    return new PortOutlet(portInfo);
  }

  addOutputDataPort(name, config) {
    const portInfo = new OutputDataSourcePortInfo(this, name, config);
    this.outputs.push(portInfo);
    return new PortOutlet(portInfo);
  }

  // Sinks

  addInputDataPort(name, config) {
    const portInfo = new InputDataSinkPortInfo(this, name, config);
    this.inputs.push(portInfo);
    return new PortOutlet(portInfo);
  }

  addOutputFlowPort(name, config) {
    const portInfo = new OutputFlowSinkPortInfo(this, name, config);
    this.outputs.push(portInfo);
    return new PortOutlet(portInfo);
  }

  //
  // Connections
  //

  addConnection(portA, portB, dryRun) {
    const isOutletA = portA instanceof PortOutlet;
    const isOutletB = portB instanceof PortOutlet;
    if (
      !(isOutletA || portA instanceof Port) ||
      !(isOutletB || portB instanceof Port)
    ) {
      throw new Error(
        `Must have two ports or outlet pair. ${portA && portA.name} -> ${
          portB && portB.name
        }`,
      );
    }
    const infoA = info(portA);
    const infoB = info(portB);
    if (
      !(isOutletA || this.chips.includes(portA.chip)) ||
      !(isOutletB || this.chips.includes(portB.chip))
    ) {
      throw new Error('Both ports must be in the chip body');
    }
    if (infoA.isFlow !== infoB.isFlow) {
      throw new Error('Can not wire flow port with data port');
    }
    if ((isOutletA ^ infoA.isInput) === (isOutletB ^ infoB.isInput)) {
      throw new Error('Can not wire ports of the same input/output side');
    }
    // TODO if isData: check types
    let source, sink;
    if (infoA.isSource ^ isOutletA) {
      source = portA;
      sink = portB;
    } else {
      source = portB;
      sink = portA;
    }
    if (this.sinkConnection.has(sink)) {
      throw new Error('Sink port already connected');
    }
    if (!dryRun) {
      const saveSource = source instanceof PortOutlet ? info(source) : source;
      const saveSink = sink instanceof PortOutlet ? info(sink) : sink;
      const sinks = this.sourceConnections.get(saveSource) || [];
      sinks.push(saveSink);
      this.sourceConnections.set(saveSource, sinks);
      this.sinkConnection.set(saveSink, saveSource);

      // When connecting and output port in a non-pure chip (aka a
      // chip with output flow defined), we automatically add all output
      // flows declared before the output data as its `computeOn`.
      // This allow for a shortcut syntax where you don't need
      // to specify output flow ports to compute this output data port on.
      if (
        saveSink instanceof OutputDataSourcePortInfo &&
        (!saveSink.computeOn || saveSink.computeOn.length === 0)
      ) {
        const computeOn = this.outputs
          .slice(0, this.outputs.indexOf(saveSink))
          .filter((i) => i.isFlow);
        saveSink.computeOn = computeOn;
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
            chipInstance[outletInfo.isInput ? 'in' : 'out'][outletInfo.name];
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

  visitConnectedPorts(port, visitor) {
    const connectedPorts = this.getConnectedPorts(port);
    if (connectedPorts.length === 0) return;
    const visitResult = visitor(...connectedPorts);
    if (visitResult === false) return;
    for (const p of connectedPorts) {
      info(p.chip).visitConnectedPorts(p, visitor);
    }
  }
}
