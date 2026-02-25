import { info } from './utils.mjs';
import { INPUT, OUTPUT } from './constants.mjs';

let placeholderCount = 0;

// A placeholder chip holds a promise that should resovle to a Chip and will
// convert itself into that Chip instance.
export class PlaceholderChip {
  constructor(chipClassPromise, chipURI, canonicalValues) {
    let idGenerated = true;
    let id =
      'placeholder_' +
      chipURI.replace(/[^_$a-z0-9]/gi, '_') +
      '_' +
      ++placeholderCount;

    let chipInstance = null;
    const chipInstancePromise = chipClassPromise.then((Chip) => {
      chipInstance = new Chip(...(canonicalValues || []));
      if (!idGenerated) {
        chipInstance.id = id;
      }
      return chipInstance;
    });

    Object.defineProperties(this, {
      chipURI: {
        enumerable: true,
        value: chipURI,
      },
      id: {
        enumerable: true,
        get() {
          return chipInstance ? chipInstance.id : id;
        },
        set(value) {
          if (chipInstance) {
            chipInstance.id = id;
          } else {
            id = value;
            idGenerated = false;
          }
        },
      },
      loaded: {
        enumerable: true,
        value: chipInstancePromise.then(() => true).catch(() => false),
      },
      isLoaded: {
        enumerable: true,
        get() {
          return !!chipInstance;
        },
      },
      loadedChipInstance: {
        enumerable: true,
        value: chipInstancePromise,
      },
      [INPUT]: {
        enumerable: true,
        value: new PlaceholderPortList(this, INPUT),
      },
      [OUTPUT]: {
        enumerable: true,
        value: new PlaceholderPortList(this, OUTPUT),
      },
      toJSON: {
        value() {
          const res = {
            id: this.id,
            chipURI: this.chipURI,
          };
          if (canonicalValues && canonicalValues.length > 0) {
            res.args = canonicalValues;
          }
          return res;
        },
      },
    });
  }

  get isPlaceholder() {
    return true;
  }
}

class PlaceholderPortList {
  constructor(placeholderChip, side) {
    const ports = [];
    return new Proxy(ports, {
      get(target, key) {
        // Already existed placeholder port
        for (const p of ports) {
          if (p.name === key) {
            return p;
          }
        }
        // Create placeholder port
        const p = new PlaceholderPort(placeholderChip, key, side);
        ports.push(p);
        return p;
      },
    });
  }
}

export class PlaceholderPort {
  constructor(placeholderChip, portName, side) {
    this.explicitValue = undefined;
    Object.defineProperties(this, {
      chip: {
        enumerable: true,
        value: placeholderChip,
      },
      name: {
        enumerable: true,
        value: portName,
      },
      fullName: {
        enumerable: true,
        get() {
          return `${placeholderChip.id}.${side}.${portName}`;
        },
      },
    });
    const placeholderPortInfo = {
      isData: true,
      isFlow: false,
      get isInput() {
        return side === INPUT;
      },
      get isOutput() {
        return side === OUTPUT;
      },
      get isSink() {
        return !!(placeholderPortInfo.isFlow ^ placeholderPortInfo.isInput);
      },
      get isSource() {
        return !placeholderPortInfo.isSink;
      },
    };
    info(this, placeholderPortInfo);
  }
}
