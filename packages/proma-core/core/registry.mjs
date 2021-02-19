const REGISTRY_VERSION = '0.1';

function getRegistry() {
  if (typeof window !== 'undefined') {
    return window.promaRegistry;
  } else if (typeof global !== 'undefined') {
    return global.promaRegistry;
  }
}

let promaRegistry = getRegistry();

if (!promaRegistry) {
  promaRegistry = initRegistry();

  // Set registry
  if (typeof window !== 'undefined') {
    window.promaRegistry = promaRegistry;
  } else if (typeof global !== 'undefined') {
    global.promaRegistry = promaRegistry;
  }
}

export const registry = promaRegistry;

// $core/lib/Add.mjs
// math/Add

// @nikso/proma-test-lib#main/Add.mjs
// await (await fetch('https://api.github.com/repos/<owner>/<repo>/branches')).json()
// await (await fetch('https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>')).text()
// https://docs.github.com/en/rest/reference/repos#contents

function initRegistry() {
  const loadedChips = new Map();

  function hasChip(chipURI) {
    return loadedChips.has(chipURI);
  }

  function addChip(chip, override) {
    // TODO verify that chip is a Chip and can have the given URI
    if (!chip || typeof chip.URI !== 'string') {
      throw new Error('Invalid Chip class');
    }
    const chipURI = chip.URI;
    if (hasChip(chipURI) && !override) {
      return false;
    }
    loadedChips.set(chipURI, chip);
    return true;
  }

  async function loadChip(chipURI) {
    if (loadedChips.has(chipURI)) {
      return loadedChips.get(chipURI);
    }
    throw new Error('unimplemented');
  }

  const registry = {
    version: REGISTRY_VERSION,
    has: hasChip,
    add: addChip,
    load: loadChip,
    list() {
      return loadedChips.keys();
    },
  };

  return Object.freeze(registry);
}
