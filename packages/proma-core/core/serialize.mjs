import { info } from './utils.mjs';
import { INPUT, OUTPUT } from './ports.mjs';

//
// Serialization
//

export function serializeChipInstance(chip, registry) {
  const res = {
    id: chip.id,
    chipURI:
      // TODO use registry.name instead to get short URIs for `use` chips
      (registry && registry.name(chip.constructor)) || chip.chipURI,
  };

  const chipInfo = info(chip);
  let canonicalData = [];
  const initData = {};
  for (const portOutlet of chipInfo.inputDataPorts) {
    const portInfo = info(portOutlet);
    const portValue = chip.in[portInfo.name].value;
    if (portInfo.canonical) {
      if (portInfo.isVariadic) {
        canonicalData.push(...portValue);
      } else {
        canonicalData.push(portValue);
      }
    } else if (typeof portValue !== 'undefined') {
      initData[portInfo.name] = portValue;
    }
  }
  // Add canonical init args
  for (let i = canonicalData.length - 1; i >= 0; i--) {
    if (typeof canonicalData[i] === 'undefined') {
      canonicalData.pop();
    } else {
      break;
    }
  }
  if (canonicalData.length > 0) {
    res.args = canonicalData;
  }
  // Add input port init data
  if (Object.keys(initData).length > 0) {
    res.init = initData;
  }
  // Store label
  if (chip.hasCustomLabel) {
    res.label = chip.label;
  }

  return res;
}

export function serializeChipInfo(chipInfo, registry) {
  const toJSON = (x) => x.toJSON(registry);
  const inputs = chipInfo.inputs.map(toJSON);
  const outputs = chipInfo.outputs.map(toJSON);
  const chips = chipInfo.chips.map(toJSON);
  const connections = Array.from(chipInfo.sinkConnection.entries()).map(
    ([sink, source]) => {
      let sourceName = source.fullName;
      let sinkName = sink.fullName;
      // If one of the ports is a flow outlet we need to invert the logic
      if (
        sink.__proto__ !== source.__proto__ &&
        (sink.isFlow || source.isFlow)
      ) {
        const tmp = sourceName;
        sourceName = sinkName;
        sinkName = tmp;
      }
      return {
        source: sourceName,
        sink: sinkName,
      };
    },
  );
  const res = {
    URI: chipInfo.URI,
  };
  if (registry) {
    const useSet = new Set(registry.useList);
    useSet.delete('proma/std');
    if (useSet && useSet.size > 0) {
      res.use = [...useSet];
    }
  }
  if (inputs.length > 0) {
    res[INPUT] = inputs;
  }
  if (outputs.length > 0) {
    res[OUTPUT] = outputs;
  }
  if (chips.length > 0) {
    res.chips = chips;
  }
  if (connections.length > 0) {
    res.connections = connections;
  }
  return res;
}

export function serializePortInfo(portInfo) {
  const res = {
    name: portInfo.name,
    kind: portInfo.isFlow ? 'flow' : 'data',
  };
  // Input flow
  if (typeof portInfo.execute !== 'undefined') {
    res.execute = funcToString(portInfo.execute);
  }
  // Input data
  if (portInfo.canonical === true) {
    res.canonical = portInfo.canonical;
  }
  if (portInfo.conceiled === true) {
    res.conceiled = portInfo.conceiled;
  }
  if (portInfo.variadic) {
    res.variadic = portInfo.variadic;
  }
  if (typeof portInfo.defaultValue !== 'undefined') {
    res.defaultValue = portInfo.defaultValue;
  }
  // Output data
  if (typeof portInfo.compute !== 'undefined') {
    res.compute = funcToString(portInfo.compute);
  }
  if (Array.isArray(portInfo.computeOn) && portInfo.computeOn.length > 0) {
    res.computeOn = portInfo.computeOn.map((p) => p.name);
  }
  if (typeof portInfo.inline !== 'undefined') {
    res.inline = portInfo.inline;
  }
  if (portInfo.allowSideEffects) {
    res.allowSideEffects = portInfo.allowSideEffects;
  }
  // Type signature
  const typeSignature = portInfo.type && portInfo.type.signature;
  if (typeSignature && typeSignature !== 'any') {
    res.type = portInfo.type.signatureWithLabels;
  }
  return res;
}

function funcToString(func) {
  // TODO use recast to clean this
  return String(func);
}
