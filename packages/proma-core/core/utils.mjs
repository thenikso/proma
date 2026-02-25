//
// Info
//

const INFO = Symbol('info');

/**
 * Attaches or retrieves hidden metadata for an object.
 *
 * @typedef {object | Function} InfoHost
 */

/**
 * Attaches or retrieves hidden metadata for an object.
 *
 * @template T
 * @param {InfoHost} obj
 * @param {T} [value]
 * @returns {T | undefined | InfoHost}
 */
export function info(obj, value) {
  const infoHost = /** @type {Record<symbol, unknown>} */ (obj);
  if (typeof value === 'undefined') {
    return /** @type {T | undefined} */ (infoHost[INFO]);
  }
  return Object.defineProperty(infoHost, INFO, {
    value,
    enumerable: false,
    writable: false,
    configurable: false,
  });
}

//
// Context
//

/** @type {unknown[]} */
const contextStack = [];

/**
 * Returns the current ambient context object.
 *
 * If `klass` is provided, this asserts that the current context is an
 * instance of that class.
 *
 * @template T
 * @param {new (...args: any[]) => T} [klass]
 * @returns {T | unknown}
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
 * @param {unknown} value
 * @returns {void}
 */
context.push = function pushContext(value) {
  contextStack.push(value);
};

/**
 * Pops and returns the latest context value.
 *
 * @returns {unknown}
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
 * @param {unknown} what
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
 * @param {InfoHost} actual
 * @param {{ name?: string } | undefined} expectInfo
 * @returns {void}
 */
export function assertInfo(actual, expectInfo) {
  const actualInfo = /** @type {{ name?: string } | undefined} */ (
    info(actual)
  );
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
