//
// Info
//

const INFO = Symbol('info');

/**
 * Attaches or retrieves hidden metadata for an object.
 *
 * @template T
 * @param {any} obj
 * @param {T} [value]
 * @returns {T | undefined | any}
 */
export function info(obj, value) {
  if (typeof value === 'undefined') {
    return obj[INFO];
  }
  return Object.defineProperty(obj, INFO, {
    value,
    enumerable: false,
    writable: false,
    configurable: false,
  });
}

//
// Context
//

/** @type {any[]} */
const contextStack = [];

/**
 * Returns the current ambient context object.
 *
 * If `klass` is provided, this asserts that the current context is an
 * instance of that class.
 *
 * @template T
 * @param {new (...args: any[]) => T} [klass]
 * @returns {T | any}
 */
export function context(klass) {
  const value = contextStack[contextStack.length - 1];
  if (klass && !(value instanceof klass)) {
    throw new Error('Not the right context');
  }
  return value;
}

/**
 * Pushes a context value onto the ambient context stack.
 *
 * @param {any} value
 * @returns {void}
 */
context.push = function pushContext(value) {
  contextStack.push(value);
};

/**
 * Pops and returns the latest context value.
 *
 * @returns {any}
 */
context.pop = function popContext() {
  return contextStack.pop();
};

//
// Assertions
//

/**
 * Throws when a condition is falsy.
 *
 * @param {any} what
 * @param {string | (() => string)} message
 * @returns {void}
 */
export function assert(what, message) {
  if (!what) {
    throw new Error(typeof message === 'function' ? message() : message);
  }
}

/**
 * Asserts that `actual` has the provided metadata identity.
 *
 * @param {any} actual
 * @param {any} expectInfo
 * @returns {void}
 */
export function assertInfo(actual, expectInfo) {
  const actualInfo = /** @type {any} */ (info(actual));
  assert(
    actualInfo === expectInfo,
    `Invalid type. Expected "${expectInfo.name}", got "${actualInfo.name}"`,
  );
}

//
// Misc
//

/**
 * Generates a short, non-cryptographic id for ephemeral runtime usage.
 *
 * @returns {string}
 */
export function shortUID() {
  return Math.abs(Date.now() ^ (Math.random() * 10000000000000)).toString(32);
}
