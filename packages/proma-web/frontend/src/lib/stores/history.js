import { writable } from 'svelte/store';

function makeHistory() {
  function toString() {
    const query = Object.entries(this.query || {})
      .filter(([, val]) => typeof val !== 'undefined')
      .map(([key, val]) => {
        if (val === true) {
          return key;
        }
        return `${key}=${String(val)}`;
      })
      .join('&');
    const hash = this.fragment;
    return decodeURIComponent(
      this.path + (query ? `?${query}` : '') + (hash ? `#${hash}` : ''),
    );
  }

  function fromString(url) {
    let host = '';
    let path = '';
    let query = '';
    let fragment = '';

    try {
      const { origin, pathname, search, hash } = new URL(
        url,
        'https://proma.dev',
      );
      host = origin;
      path = pathname;
      query = search;
      fragment = hash;
    } catch {}

    query = !query.trim()
      ? {}
      : Object.fromEntries(
          query
            // '?one=1&two=two&three&four='
            .substr(1)
            // 'one=1&two=two&three&four='
            .split('&')
            // ['one=1', 'two=two', 'three', 'four=']
            .map((p) => {
              const [key, val] = p.split('=');
              return [
                key,
                !val && p.length === key.length ? 'true' : val || '',
              ];
            })
            // [['one', '1'], ['two', 'two'], ['three', 'true'], ['four', '']]
            .map(([key, val]) => {
              let v = val.trim().toLocaleLowerCase();
              if (v === 'true') {
                val = true;
              } else if (v === 'false') {
                val = false;
              } else if (v === 'null') {
                val = null;
              } else if (!v) {
                val = '';
              } else if ((v = parseFloat(v) && !isNaN(v))) {
                val = v;
              } else {
                v = val;
              }
              return [key, v];
            }),
          // [['one', 1], ['two', 'two'], ['three', true], ['four', undefined]]
        );

    fragment = fragment.substr(1);

    return {
      host,
      path,
      query,
      fragment,
      toString,
    };
  }

  const { subscribe, set, update } = writable(
    fromString(window.location),
    (set) => {
      const setHistory = () => {
        set(fromString(window.location));
      };
      window.addEventListener('popstate', setHistory);
      return () => {
        window.removeEventListener('popstate', setHistory);
      };
    },
  );

  subscribe(($route) => {
    if ($route.toString() !== fromString(window.location).toString()) {
      window.history.pushState({}, null, $route.toString());
    }
  });

  return {
    subscribe,
    set,
    update,
    push: (url) => set(fromString(url)),
    replace: (url) => {
      window.history.replaceState({}, null, url);
      set(fromString(url));
    },
  };
}

export const history = makeHistory();
