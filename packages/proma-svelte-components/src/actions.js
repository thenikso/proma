const actions = new Map();

export function action(actionId) {
  const handler = actions.get(actionId);
  if (typeof handler !== 'function') {
    return function actionHandler(...args) {
      const handler = actions.get(actionId);
      if (typeof handler !== 'function') {
        console.warn(`Can not find action "${actionId}"`);
      }
      return handler(...args);
    };
  }
  return handler;
}

action.provide = function provideAction(actionId, handler) {
  actions.set(actionId, handler);
};

action.all = function allActions(...actions) {
  return (...args) => {
    for (const a of actions) {
      a(...args);
    }
  };
};
