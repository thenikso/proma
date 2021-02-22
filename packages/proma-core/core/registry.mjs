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
  const resolvers = [];
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
    const selectedResolvers = resolvers
      .map((resolver) => ({ match: resolver.test(chipURI), resolver }))
      .filter(({ match }) => !!match);
    if (selectedResolvers.length === 0) {
      throw new Error(`Can not resolve chip URI: ${chipURI}`);
    }
    // TODO resolver's priority?
    let res;
    let error;
    for (const { match, resolver } of selectedResolvers) {
      try {
        res = await resolver.load(chipURI, match);
        break;
      } catch (e) {
        if (!error) {
          error = e;
        }
      }
    }
    if (!res) {
      throw error || new Error(`Could not load URI: ${chipURI}`);
    }
    return res;
  }

  function addResolver(resolver) {
    if (!resolver || !resolver.test || typeof resolver.load !== 'function') {
      throw new Error(
        'Invalid resolver. test and load properties are required.',
      );
    }
    const test =
      resolver.test instanceof RegExp
        ? resolver.test
        : new RegExp(resolver.test);
    resolvers.push({
      ...resolver,
      test,
    });
  }

  const registry = {
    version: REGISTRY_VERSION,
    has: hasChip,
    add: addChip,
    load: loadChip,
    list() {
      return loadedChips.keys();
    },
    loader: addResolver,
  };

  return Object.freeze(registry);
}
