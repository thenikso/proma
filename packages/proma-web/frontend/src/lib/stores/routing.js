import { writable, derived } from 'svelte/store';
import { history } from './history';

export const routes = writable([]);

const matchableRoutes = derived(routes, ($routes, set) => {
  set(
    $routes.map((route) => ({
      match: makeMatch(route.path),
      ...route,
    })),
  );
});

export const page = derived(
  [history, matchableRoutes],
  ([$history, $routes], set) => {
    const path = $history.path;
    for (const { match, ...route } of $routes) {
      const params = match(path);
      if (params) {
        set({
          ...$history,
          ...route,
          params,
        });
        return;
      }
    }
    set(null);
  },
);

function makeMatch(pattern, loose = false) {
  const { regexp, keys } = regexparam(pattern, loose);
  return (path) => match(regexp, keys, path);
}

function match(regexp, keys, path) {
  const matches = regexp.exec(path);
  if (!matches) return false;
  const l = keys.length;
  if (l === 0) return {};
  const res = {};
  for (let i = 0; i < l; i++) {
    res[keys[i]] = matches[i + 1];
  }
  return res;
}

// https://github.com/lukeed/regexparam
function regexparam(str, loose) {
  if (str instanceof RegExp) return { keys: false, pattern: str };
  var c,
    o,
    tmp,
    ext,
    keys = [],
    pattern = '',
    arr = str.split('/');
  arr[0] || arr.shift();

  while ((tmp = arr.shift())) {
    c = tmp[0];
    if (c === '*') {
      keys.push('wild');
      pattern += '/(.*)';
    } else if (c === ':') {
      o = tmp.indexOf('?', 1);
      ext = tmp.indexOf('.', 1);
      keys.push(tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length));
      pattern += !!~o && !~ext ? '(?:/([^/]+?))?' : '/([^/]+?)';
      if (!!~ext) pattern += (!!~o ? '?' : '') + '\\' + tmp.substring(ext);
    } else {
      pattern += '/' + tmp;
    }
  }

  return {
    keys: keys,
    regexp: new RegExp('^' + pattern + (loose ? '(?=$|/)' : '/?$'), 'i'),
  };
}
