import { isChipClass } from './chip.mjs';

import * as lib from './library/index.mjs';

// `Registry` is a store for chips specified with the `use` keyword
// that are available during editing (and hence also deserialize).
export class Registry {
  // Map from full qualified URI to chip class.
  #qualifiedToChip;
  // Chip classes to an array of [qualifiedName, URI | undefined].
  // The second element of the array is defined if the chip is registered
  // via the `use` method.
  #chipToQualifiers;
  // A map from a chip URI to the chip class. This will be only populated if the
  // chip is registered via `use`. If attempting to `use` a library which would
  // conflict with an existing URI in here, the `use` method will throw.
  #uriToChip;
  // A map of `use` strings to an array of Chip classes loaded with that `use`.
  #useToChips;
  // List of resolvers as objects containing:
  // - `test`: a regular expression matching a qualified chip name
  // - `load`: a function receiving the `add` method of this registry and the
  //           `test` match result.
  // See `resolver` for more details.
  #resolvers;

  constructor() {
    this.#qualifiedToChip = new Map();
    this.#chipToQualifiers = new Map();
    this.#uriToChip = new Map();
    this.#resolvers = [];
    this.#useToChips = new Map();
  }

  // The list of `use` strings that have been used to load chips.
  get useList() {
    return Array.from(this.#useToChips.keys());
  }

  get chipList() {
    return Array.from(this.#chipToQualifiers.keys());
  }

  // Add a chip to the registry. You can pass a valid Chip or an array of Chips
  // or an object with other valid `add` values.
  add(chip, qualifier) {
    return this.#add(chip, qualifier, null);
  }

  #add(chip, qualifier, useChipCb) {
    if (Object.isFrozen(this)) {
      throw new Error('Cannot add to a locked registry');
    }
    if (Array.isArray(chip)) {
      chip.forEach((c) => this.#add(c, qualifier, useChipCb));
      return this;
    }
    if (!isChipClass(chip)) {
      if (typeof chip === 'object' && chip) {
        this.#add(Array.from(Object.values(chip)), qualifier, useChipCb);
        return this;
      }
      throw new Error('chip must be a Chip');
    }
    if (this.#chipToQualifiers.has(chip)) {
      throw new Error(`Chip ${chip.URI} is already registered`);
    }
    let qualifiedName = chip.URI;
    if (qualifier) {
      qualifiedName = `${qualifier}#${qualifiedName}`;
    }
    if (this.#qualifiedToChip.has(qualifiedName)) {
      throw new Error(`Duplicate qualified name: ${qualifiedName}`);
    }
    this.#qualifiedToChip.set(qualifiedName, chip);
    this.#chipToQualifiers.set(chip, [qualifiedName]);
    if (useChipCb) {
      useChipCb(chip);
    }
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
    const loadedChips = [];
    await this.#resolve(qualifiedName, (chip, qualifier) =>
      this.#add(chip, qualifier, (chip) => {
        if (this.#uriToChip.has(chip.URI)) {
          throw new Error(`Use of ambiguous chip URI: ${chip.URI}`);
        }
        this.#uriToChip.set(chip.URI, chip);
        loadedChips.push(chip);
        // Adds the unqualified URI to the valid qualifiers for the chip
        this.#chipToQualifiers.get(chip).push(chip.URI);
      }),
    );
    this.#useToChips.set(qualifiedName, loadedChips);
    // TODO also throw if nothing resolved?
    return this;
  }

  unuse(qualifiedName) {
    if (Object.isFrozen(this)) {
      throw new Error('Cannot remove from a locked registry');
    }
    const chips = this.#useToChips.get(qualifiedName);
    if (!chips) {
      throw new Error(`No chips registered with use ${qualifiedName}`);
    }
    chips.forEach((chip) => {
      this.#uriToChip.delete(chip.URI);
      this.#qualifiedToChip.delete(this.#chipToQualifiers.get(chip)[0]);
      this.#chipToQualifiers.delete(chip);
    });
    this.#useToChips.delete(qualifiedName);
    return this;
  }

  // Returns true if there is at least one chip with the given name
  // in the registry.
  has(name) {
    return this.#qualifiedToChip.has(name) || this.#uriToChip.has(name);
  }

  // Get the chip class in the registry with the given name.
  // If the chip is not found or the name is ambiguous, throws an error.
  // Returns either the chip or a promise resolving to the chip.
  load(name) {
    const chip = this.#qualifiedToChip.get(name) || this.#uriToChip.get(name);
    if (chip) {
      return chip;
    }
    const resolveChip = this.#resolve(name, (chip, qualifier) =>
      this.#add(chip, qualifier),
    );
    const getChip = () => {
      const chip = this.#qualifiedToChip.get(name);
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

  // Returns the shortest name for the given chip according to this
  // registry. That could be the `qualifiedName` or the chip `URI`
  // if the chip is registered via the `use` method.
  name(chip) {
    const [fullQualifiedName, localQualifiedName] =
      this.#chipToQualifiers.get(chip) || [];
    return localQualifiedName || fullQualifiedName;
  }

  // If the given chip is registered, returns the qualified name
  // according to this registry.
  qualifiedName(chip) {
    return (this.#chipToQualifiers.get(chip) || [])[0];
  }

  // Returns the list of all qualified names in the registry.
  get qualifiedNames() {
    return Array.from(this.#qualifiedToChip.keys());
  }

  // Copy the registry to a new registry that allows changes even
  // if the original registry is locked.
  get copy() {
    const copy = new Registry();
    copy.#qualifiedToChip = new Map(this.#qualifiedToChip);
    copy.#uriToChip = new Map(this.#uriToChip);
    copy.#chipToQualifiers = new Map(this.#chipToQualifiers);
    copy.#resolvers = this.#resolvers.slice();
    copy.#useToChips = new Map(this.#useToChips);
    return copy;
  }

  // Locks the registry to prevent further changes.
  get lock() {
    Object.freeze(this);
    return this;
  }
}

export const registry = new Registry()
  .resolver(/^proma\/std(?:#(.+))?$/, (add) => add(lib.std, 'proma/std'))
  .resolver(/^proma\/web(?:#(.+))?$/, (add) => add(lib.web, 'proma/web'))
  .resolver(/^proma\/node(?:#(.+))?$/, (add) =>
    add(lib.node, 'proma/node'),
  ).lock;
