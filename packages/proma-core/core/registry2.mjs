import { isChipClass } from './chip.mjs';

// `Registry` is a store for chips specified with the `use` keyword
// that are available during editing (and hence also deserialize).
export class Registry {
  #qualifiedChips;
  #uriChips;
  #chipsQualifiers;
  #resolvers;

  constructor() {
    this.#qualifiedChips = new Map();
    this.#uriChips = new Map();
    this.#chipsQualifiers = new Map();
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
    if (this.#uriChips.has(chip.URI)) {
      this.#uriChips.delete(chip.URI);
    } else {
      this.#uriChips.set(chip.URI, chip);
    }
    return this;
  }

  // Adds a resolver to be used when `use` is called.
  // `test` should be a regular expression matching a qualified chip name.
  // `load` should be a function receiving the `add` method of this registry
  // and the `test` match result.
  resolver(test, load) {
    if (Object.isFrozen(this)) {
      throw new Error('Cannot add to a locked registry');
    }
    this.#resolvers.push({ test, load });
    return this;
  }

  // Given a string, attempts to resolve it with a `resolver` and
  // loads in the registry all the chips returned by the resolver.
  async use(qualifiedName) {
    const resolver = this.#resolvers
      .map((r) => ({ match: r.test.test(qualifiedName), load: r.load }))
      .find((r) => r.match);
    if (!resolver) {
      throw new Error(`No resolver found for ${qualifiedName}`);
    }
    await resolver.load(this.add.bind(this), resolver.match);
    return this;
  }

  // Returns true if there is at least one chip with the given name
  // in the registry.
  has(name) {
    return this.#qualifiedChips.has(name) || this.#uriChips.has(name);
  }

  // Get the chip class in the registry with the given name.
  // If the chip is not found or the name is ambiguous, throws an error.
  // Returns either the chip or a promise resolving to the chip.
  get(name) {
    const chip = this.#qualifiedChips.get(name) || this.#uriChips.get(name);
    if (!chip) {
      throw new Error(`Unknown chip: ${name}`);
    }
    return chip;
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
    copy.#uriChips = new Map(this.#uriChips);
    copy.#chipsQualifiers = new Map(this.#chipsQualifiers);
    copy.#resolvers = this.#resolvers.slice();
    return copy;
  }

  // Locks the registry to prevent further changes.
  get lock() {
    Object.freeze(this.#qualifiedChips);
    Object.freeze(this.#uriChips);
    Object.freeze(this.#chipsQualifiers);
    Object.freeze(this.#resolvers);
    Object.freeze(this);
    return this;
  }
}

// TODO add standard lib and lock, move to separate file?
export const std = new Registry();
