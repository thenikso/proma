import { INPUT, OUTPUT } from './ports.mjs';
import { edit } from './edit.mjs';

export function fromJSON(chip, data, withErrors) {
  const ChipClass = deserializeChip(chip, data, withErrors);
  ChipClass.metadata = data.metadata;
  return ChipClass;
}

//
// Deserialization
//

function deserializeChip(chip, data, withErrors) {
  // TODO validate `data`
  const res = chip(data.URI, null, { editable: true });
  const build = edit(res);
  const errors = [];
  const portsToCompile = [];
  for (const port of data[INPUT] || []) {
    try {
      if (port.kind === 'flow') {
        build.addInputFlowOutlet(port.name);
        if (port.execute) {
          portsToCompile.push(port);
        }
      } else {
        build.addInputDataOutlet(port.name, {
          canonical: port.canonical,
          conceiled: port.conceiled,
          defaultValue: port.defaultValue,
        });
      }
    } catch (e) {
      errors.push(e);
    }
  }
  for (const port of data[OUTPUT] || []) {
    try {
      if (port.kind === 'flow') {
        build.addOutputFlowOutlet(port.name);
      } else {
        build.addOutputDataOutlet(port.name, {
          computeOn: (port.computeOn || []).map((portPath) =>
            build.getPort(portPath, 'out'),
          ),
          inline: port.inline,
          allowSideEffects: port.allowSideEffects,
        });
        if (port.compute) {
          portsToCompile.push(port);
        }
      }
    } catch (e) {
      errors.push(e);
    }
  }
  for (const chipData of data.chips || []) {
    build.addChip(chipData.chipURI, chipData.args, chipData.id);
    if (chipData.label) {
      build.setChipLabel(chipData.id, chipData.label);
    }
  }
  for (const conn of data.connections || []) {
    try {
      build.addConnection(conn.source, conn.sink);
    } catch (e) {
      errors.push(e);
    }
  }
  for (const port of portsToCompile) {
    try {
      if (port.execute) {
        build.setPortExecute(port.name, port.execute);
      } else if (port.compute) {
        build.setPortCompute(port.name, port.compute);
      }
    } catch (e) {
      errors.push(e);
    }
  }
  if (errors.length > 0 && typeof withErrors === 'function') {
    withErrors(errors);
  }
  return build.Chip;
}
