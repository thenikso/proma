//
// Info
//

const INFO = Symbol('info');

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

const contextStack = [];

export function context(klass) {
  const value = contextStack[contextStack.length - 1];
  if (klass && !(value instanceof klass)) {
    throw new Error('Not the right context');
  }
  return value;
}

context.push = function pushContext(value) {
  contextStack.push(value);
};

context.pop = function popContext() {
  return contextStack.pop();
};

//
// Assertions
//

export function assert(what, message) {
  if (!what) {
    throw new Error(typeof message === 'function' ? message() : message);
  }
}

export function assertInfo(actual, expectInfo) {
  const actualInfo = info(actual);
  assert(
    actualInfo === expectInfo,
    `Invalid type. Expected "${expectInfo.name}", got "${actualInfo.name}"`,
  );
}

//
// Misc
//

export function shortUID() {
  return Math.abs(Date.now() ^ (Math.random() * 10000000000000)).toString(32);
}
