const actions = new Map();

export function action(actionId) {
  const handler = actions.get(actionId);
  if (typeof handler === 'function') {
    return handler;
  }
  throw new Error(`Can not find action "${actionId}"`);
}

action.provide = function provideAction(actionId, handler) {
  actions.set(actionId, handler);
};
