import { isChipClass } from './chip.mjs';

import * as lib from './library/index.mjs';

// `Registry` is a store for chips specified with the `use` keyword
// that are available during editing (and hence also deserialize).
export class Registry {
  // Map from full qualified URI to chip class.
  #qualifiedChips;
  // Inverese of `#qualifiedChips`. Chip classes to full qualified names.
  #chipsQualifiers;
  // A map from a chip URI to the chip class. This will be only populated if the
  // chip is registered via `use`. If attempting to `use` a library which would
  // conflict with an existing URI in here, the `use` method will throw.
  #useShortcuts;
  // List of resolvers as objects containing:
  // - `test`: a regular expression matching a qualified chip name
  // - `load`: a function receiving the `add` method of this registry and the
  //           `test` match result.
  // See `resolver` for more details.
  #resolvers;

  constructor() {
    this.#qualifiedChips = new Map();
    this.#chipsQualifiers = new Map();
    this.#useShortcuts = new Map();
    this.#resolvers = [];
  }

  // Add a chip to the registry. You can pass a valid Chip or an array of Chips
  // or an object with other valid `add` values.
  add(chip, qualifier) {
    if (Object.isFrozen(this)) {
      throw new Error('Cannot add to a locked registry');
    }
    if (Array.isArray(chip)) {
      chip.forEach((c) => this.add(c, qualifier));
      return this;
    }
    if (!isChipClass(chip)) {
      if (typeof chip === 'object' && chip) {
        this.add(Array.from(Object.values(chip)), qualifier);
        return this;
      }
      throw new Error('chip must be a Chip');
    }
    if (this.#chipsQualifiers.has(chip)) {
      throw new Error(`Chip ${chip.URI} is already registered`);
    }
    let qualifiedName = chip.URI;
    if (qualifier) {
      qualifiedName = `${qualifier}#${qualifiedName}`;
    }
    if (this.#qualifiedChips.has(qualifiedName)) {
      throw new Error(`Duplicate qualified name: ${qualifiedName}`);
    }
    this.#qualifiedChips.set(qualifiedName, chip);
    this.#chipsQualifiers.set(chip, qualifiedName);
    return this;
  }

  // Adds a resolver to be used when `use` or `load` is called.
  // `test` should be a regular expression matching a qualified chip name.
  // `load` should be a function receiving the `add` method of this registry
  // and the `test` match result. The function should return a promise resolving
  // when the requested match has been added to the registry.
  resolver(test, load) {
    if (Object.isFrozen(this)) {
      throw new Error('Cannot add to a locked registry');
    }
    this.#resolvers.push({ test, load });
    return this;
  }

  #resolve(qualifiedName, addChipToRegistry) {
    // Search for resolvers
    const resolvers = this.#resolvers
      .map((r) => ({ match: r.test.exec(qualifiedName), load: r.load }))
      .filter((r) => r.match);
    if (resolvers.length === 0) {
      return false;
    }
    // Prepare resolution indicator
    let didResolve = false;
    const add = (chip, qualifier) => {
      didResolve = true;
      addChipToRegistry(chip, qualifier);
    };
    // Attempt to resolve syncronously
    const fastResolve = resolvers[0].load(add, resolvers[0].match);
    if (!(fastResolve instanceof Promise) && didResolve) {
      return true;
    }
    // Resolve with promise
    return Promise.resolve().then(async () => {
      let error;
      let didResolve = await fastResolve
        .then(() => true)
        .catch((err) => {
          error = err;
          return false;
        });
      for (let i = 1, l = resolvers.length; i < l && !didResolve; i++) {
        const resolver = resolvers[i];
        didResolve = await Promise.resolve(
          resolver.load(addChipToRegistry, resolver.match),
        )
          .then(() => true)
          .catch((err) => {
            error = err;
            return false;
          });
      }
      if (!didResolve) {
        throw error || new Error(`Failed to resolve ${qualifiedName}`);
      }
    });
  }

  // Given a string, attempts to resolve it with a `resolver` and
  // loads in the registry all the chips returned by the resolver.
  async use(qualifiedName) {
    await this.#resolve(qualifiedName, (chip, qualifier) => {
      if (this.#useShortcuts.has(chip.URI)) {
        throw new Error(`Use of ambiguous chip URI: ${chip.URI}`);
      }
      this.#useShortcuts.set(chip.URI, chip);
      return this.add(chip, qualifier);
    });
    // TODO also throw if nothing resolved?
    return this;
  }

  // Returns true if there is at least one chip with the given name
  // in the registry.
  has(name) {
    return this.#qualifiedChips.has(name) || this.#useShortcuts.has(name);
  }

  // Get the chip class in the registry with the given name.
  // If the chip is not found or the name is ambiguous, throws an error.
  // Returns either the chip or a promise resolving to the chip.
  load(name) {
    const chip = this.#qualifiedChips.get(name) || this.#useShortcuts.get(name);
    if (chip) {
      return chip;
    }
    const resolveChip = this.#resolve(name, (chip, qualifier) =>
      this.add(chip, qualifier),
    );
    const getChip = () => {
      const chip = this.#qualifiedChips.get(name);
      if (!chip) {
        throw new Error(
          `Failed to load "${name}". Maybe it is not registered or not fully qualified?`,
        );
      }
      return chip;
    };
    if (resolveChip instanceof Promise) {
      return resolveChip.then(getChip);
    }
    return getChip();
  }

  // If the given chip is registered, returns the qualified name
  // according to this registry.
  qualifiedName(chip) {
    return this.#chipsQualifiers.get(chip);
  }

  // Returns the list of all qualified names in the registry.
  get qualifiedNames() {
    return Array.from(this.#qualifiedChips.keys());
  }

  // Copy the registry to a new registry that allows changes even
  // if the original registry is locked.
  get copy() {
    const copy = new Registry();
    copy.#qualifiedChips = new Map(this.#qualifiedChips);
    copy.#useShortcuts = new Map(this.#useShortcuts);
    copy.#chipsQualifiers = new Map(this.#chipsQualifiers);
    copy.#resolvers = this.#resolvers.slice();
    return copy;
  }

  // Locks the registry to prevent further changes.
  get lock() {
    Object.freeze(this.#resolvers);
    Object.freeze(this);
    return this;
  }
}

export const registry = new Registry()
  .add(lib.std, 'proma/std')
  .resolver(/^proma\/web(?:#(.+))?$/, (add) => add(lib.web, 'proma/web'))
  .resolver(/^proma\/node(?:#(.+))?$/, (add) => add(lib.node, 'proma/node'))
  .lock;
