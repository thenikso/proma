// TODO onMount add document watchers, remove on destroy if no one else has makeShortcutDispatcher

import { setContext, getContext, onMount } from 'svelte';
import { readable, derived } from 'svelte/store';

let setShortcuts;

export const shortcuts = readable({}, (set) => {
  setShortcuts = set;
});

const resolvedGlobalShortcuts = new Map();
let globalShortcutsMathers = [];

shortcuts.set = function addGlobalShortcut(shortcut, action) {
  resolvedGlobalShortcuts.set(
    shortcut,
    resolveSingleShortcut(shortcut, action),
  );
  globalShortcutsMathers = Array.from(resolvedGlobalShortcuts.values());
  // TODO update shortcuts store
  // setShortcuts(Object.fromEntries());
};

export class ShortcutEvent {
  constructor(shortcut, targetPath, sourceEvent) {
    this.type = 'shortcut';
    this.shortcut = shortcut;
    this.target = targetPath[targetPath.length - 1];
    this.path = targetPath;
    this.sourceEvent = sourceEvent;
  }
}

//
// Shortcut matching
//

const TARGET_PATH_RESOLVERS = Symbol('target-path-resolvers');

// - `targetSelectors` is an array of target resolvers like
//   [{ id: 'board', target: board, select: event => event.path[0] == somehthing }]
export function createShortcutDispatcher(targetSelectors, localShortcuts) {
  // Parent `<Shortcuts>` will define additional target selectors, making a path
  // to the current shortcut
  const parentTargetPathResolvers = getContext(TARGET_PATH_RESOLVERS) || [];
  const targetPathResolvers = parentTargetPathResolvers.slice();
  const localTargetResolvers = makeSingleTargetResolver(targetSelectors);
  targetPathResolvers.push(localTargetResolvers);
  setContext(TARGET_PATH_RESOLVERS, targetPathResolvers);

  let resolvedLocalShortcuts = [];

  function dispatch(event) {
    dispatchShortcuts(event, targetPathResolvers, resolvedLocalShortcuts);
  }

  Object.defineProperty(dispatch, 'localShortcuts', {
    get() {
      return Object.fromEntries(
        resolvedLocalShortcuts.map(({ shortcut, action }) => [
          shortcut,
          action,
        ]),
      );
    },
    set(value) {
      resolvedLocalShortcuts = Object.entries(value || {}).map(([s, a]) =>
        resolveSingleShortcut(s, a),
      );
    },
  });

  dispatch.localShortcuts = localShortcuts;

  return dispatch;
}

function dispatchShortcuts(event, targetPathResolvers, localShortcuts) {
  // Match event
  let localMatches = [];
  if (localShortcuts) {
    localMatches = localShortcuts.filter(({ matchEvent }) => matchEvent(event));
  }
  let globalMatches = [];
  if (globalShortcutsMathers.length > 0) {
    globalMatches = globalShortcutsMathers.filter(({ matchEvent }) =>
      matchEvent(event),
    );
  }
  if (localMatches.length === 0 && globalMatches.length === 0) return;
  // Prepare event path (for firefox)
  if (!event.path) {
    event.path = [];
    let t = e.target;
    while (t) {
      event.path.unshift(t);
      t = t.parentElement;
    }
  }
  // Prepare targets
  const targetPathLastIndex = targetPathResolvers.length - 1;
  let targetsPath = targetPathResolvers.map((singleTargetResolver, i) => {
    const targets = singleTargetResolver(event);
    return targets;
  });
  // Match targets
  // These generates objects like:
  // { targetsPath: [[obj], [obj, obj]], shortcut: '[board] cmd+c', action: (ShortcutEvent) => void }
  if (localMatches.length > 0) {
    matchTargetAndDispatch(
      localMatches,
      [targetsPath[targetsPath.length - 1]],
      event,
    );
  }
  if (globalMatches.length > 0) {
    targetsPath = targetsPath.map((singleTarget) =>
      singleTarget.map(({ id, target, present }) => ({
        id,
        target:
          typeof present === 'function'
            ? present(target)
            : typeof present === 'undefined'
            ? target
            : present,
      })),
    );
    matchTargetAndDispatch(globalMatches, targetsPath, event);
  }
}

function matchTargetAndDispatch(resolvedShortcuts, fullTargetsPath, event) {
  const shortcuts = resolvedShortcuts
    .map(({ matchTarget, shortcut, action }) => ({
      targetPath: matchTarget(fullTargetsPath),
      shortcut,
      action,
    }))
    .filter(({ targetPath }) => targetPath.length > 0);
  for (const { targetPath, shortcut, action } of shortcuts) {
    action(new ShortcutEvent(shortcut, targetPath, event));
  }
}

//
// Target resolution
//

// From an array or `selectors` like:
//     [
//       { id: 'board', select: board, present: () => 'something-for-global-view' },
//       { id: 'selection', select: e => !grab && e.button === 0 ? selection : null },
//       { id: 'chip', select: e => !grab && e.path.filter(p => p.$promaChip).map(p => p.promaChip)[0] },
//       { id: 'chip', select: (e, pathSoFar) => !grab && e.type === 'keydown' && !pathSoFar.includes('chip') && selectedChips },
//       { id: 'port', select: e => !grab && e.path.filter(p => p.$promaPort).map(p => p.promaPort)[0] },
//     ]
// Returns a function that, given an `event` generates internally a path like:
//     [{ id: 'board', target: board }, { id: 'selection', target: selection }, {id: 'chip', target: [chip, chip] } ]
// And returns the last element as the target (wrapping target as an array if not already):
//     { id: 'chip', target: [chip, chip] }
function makeSingleTargetResolver(selectors) {
  if (!Array.isArray(selectors) || selectors.length === 0) {
    return function emptyTargetResolver() {
      return [];
    };
  }
  return function singleTargetResolver(event) {
    const targetsPath = [];
    const targetsIdsPath = [];
    for (let i = 0, l = selectors.length; i < l; i++) {
      const { id, select, present } = selectors[i];
      const target =
        typeof select === 'function' ? select(event, targetsIdsPath) : select;
      if (target) {
        targetsPath.push({ id, target, present });
        targetsIdsPath.push(id);
      }
    }
    return targetsPath;
  };
}

// Given a targetsString like `parent:subTarget` return a function that accepts
// a targets path like:
//     [ [ { id: 'parent', target: obj } ], [ { id: 'subTarget', target: obj2 }, { id: 'subTarget2', target: obj3 } ] ]
// And returns an array:
//     [ { id: 'parent', target: obj }, { id: 'subTarget', target: obj2 } ]
function makeTargetMatcher(targetsString) {
  const targetIdsToMatch = targetsString
    .split(':')
    .map((x) => x.split('|').map((x) => x.trim()));
  const idsLen = targetIdsToMatch.length;
  return function matchTarget(targetsPath) {
    const res = [];
    const pathLen = targetsPath.length;
    if (idsLen > pathLen) return res;
    for (let i = 1, l = idsLen; i <= l; i++) {
      const segmentTargets = targetsPath[pathLen - i];
      const idsToMatch = targetIdsToMatch[idsLen - i];
      let segmentSelection;
      for (let j = segmentTargets.length - 1; j >= 0; j--) {
        const { id, target } = segmentTargets[j];
        // TODO support for *?
        if (idsToMatch.includes(id)) {
          segmentSelection = target;
          break;
        }
      }
      if (!segmentSelection) break;
      res.unshift(segmentSelection);
    }
    return res;
  };
}

//
// Shortcut resolution
//

const shortcutRegExp = /^(?:\[(.+)\])?\s*(.+)$/;

// Translate an object like:
//     { '[traget:subTarget] cmd+C': 'my.action' }
// to an array like:
//     [ { matchTarget: (string) => boolean, matcheEvent: (Event) => boolean, action: func } ]
export function resolveShortcuts(shortcuts = {}) {
  return Object.entries(shortcuts || {}).reduce((acc, [shortcut, action]) => {
    return resolveSingleShortcut(shortcut, action);
  });
}

function resolveSingleShortcut(shortcut, action) {
  const [, targetString, eventsString] = shortcutRegExp.exec(shortcut) || [];
  if (!eventsString) {
    console.warn(`Invalid shortcut "${shortcut}"`);
    return null;
  }
  const targets = targetString.trim() || '*';
  const matchEvent = makeShortcutMatcher(eventsString);
  const matchTarget = makeTargetMatcher(targets);
  return { shortcut, matchTarget, matchEvent, action };
}

// Transform an event matcher string like "alt+click" (or series of events like
// "cmd+K > cmd+L") into a function that matches an event and return a boolean.
function makeShortcutMatcher(eventString) {
  // combinations is [ ['alt', 'click] ] or [ ['cmd', 'k'], ['cmd', 'x'] ]
  const combinations = eventString
    .toLowerCase()
    .split('>')
    .map((x) => x.split('+').map((x) => x.trim()));
  // combinationsMathcers is [ [ matcherFunc, matcherFunc ] ]
  const combinationsMathcers = combinations.map((tokens) =>
    tokens.map(makeShortcutTokenMatcher),
  );
  // sequenceMathers is [ shortcutMatcher ] or [ shortcutMatcher, shortcutMatcher ]
  // of matchers to be matched in sequence
  const sequenceMathers = combinationsMathcers.map(
    (matchers) =>
      function shortcutMatcher(event) {
        for (let i = 0, l = matchers.length; i < l; i++) {
          if (!matchers[i](event)) {
            return false;
          }
        }
        return true;
      },
  );
  // If only one matcher, we return that
  const sequenceSize = sequenceMathers.length;
  if (sequenceSize === 1) {
    return sequenceMathers[0];
  }
  // Create sequence mather
  let sequenceIndex = 0;
  return function shortcutSequenceMatcher(event) {
    if (sequenceMathers[sequenceIndex](event)) {
      sequenceIndex++;
      if (sequenceIndex === sequenceSize) {
        sequenceIndex = 0;
        return true;
      }
    } else if (sequenceIndex > 0) {
      sequenceIndex = 0;
    }
    return false;
  };
}

function makeShortcutTokenMatcher(shortcutToken) {
  switch (shortcutToken) {
    case 'click':
    case 'doubleclick':
    case 'mouseenter':
    case 'mousewheel':
    case 'mouseleave':
    case 'mousedown':
    case 'mouseup':
    case 'mousemove':
    case 'contextmenu':
      return (e) => e.type === shortcutToken;
    case 'alt':
      return (e) => e.altKey;
    case 'ctrl':
      return (e) => e.ctrlKey;
    case 'cmd':
    case 'meta':
    case 'win':
      return (e) => e.metaKey;
    default:
      return (e) =>
        (e.type === 'keydown' || e.type === 'keyup') &&
        (e.type === shortcutToken ||
          e.code.toLowerCase() === shortcutToken ||
          e.key.toLowerCase() === shortcutToken);
  }
}

//
// Event catching
//

let eventsConnectorsCount = 0;

function connectEventsIfNeeded() {
  eventsConnectorsCount++;
  if (eventsConnectorsCount > 1) return;
}

function disconnectEventsIfNeede() {
  eventsConnectorsCount--;
  if (eventsConnectorsCount > 0) return;
}
