import { info } from './utils.mjs';

export function serializeChipInstance(chip) {
  const res = {
    id: chip.id,
    chipURI: chip.chipURI,
  };

  const chipInfo = info(chip);
  let canonicalData = [];
  const initData = {};
  for (const portInfo of chipInfo.inputDataPorts) {
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
    }
  }
  if (canonicalData.length > 0) {
    res.args = canonicalData;
  }
  // Add input port init data
  if (Object.keys(initData).length > 0) {
    res.init = initData;
  }

  return res;
}

export function serializeChipInfo(chipInfo) {
  const toJSON = (x) => x.toJSON();
  const inputs = chipInfo.inputs.map(toJSON);
  const outputs = chipInfo.outputs.map(toJSON);
  const chips = chipInfo.chips.map(toJSON);
  const connections = Array.from(chipInfo.sinkConnection.entries()).map(
    ([sink, source]) => ({
      source: source.fullName || source.name,
      sink: sink.fullName || sink.name,
    }),
  );
  const res = {
    URI: chipInfo.URI,
  };
  if (inputs.length > 0) {
    res.inputs = inputs;
  }
  if (outputs.length > 0) {
    res.outputs = outputs;
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
    res.execute = String(portInfo.execute);
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
    res.compute = String(portInfo.compute);
  }
  if (Array.isArray(portInfo.computeOn) && portInfo.computeOn.length > 0) {
    res.computeOn = portInfo.computeOn.map((p) => p.name);
  }
  if (typeof portInfo.inline !== 'undefined') {
    res.inline = portInfo.inline;
  }
  return res;
}
