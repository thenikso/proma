import { writable, readable, derived, get } from 'svelte/store';

/* global: AUTH0_DOMAIN, AUTH0_CLIENTID, createAuth0Client */

let resolveAuth0Client;
let rejectAuth0Client;
export const authInitialized = new Promise((resolve, reject) => {
  resolveAuth0Client = resolve;
  rejectAuth0Client = reject;
});

let _auth0Client;
let setAuth0Client;
export const auth0Client = readable(null, (set) => {
  setAuth0Client = set;
  if (_auth0Client) {
    set(_auth0Client);
  }
});

const authChanged = writable(0);

if (AUTH0_DOMAIN && AUTH0_CLIENTID) {
  async function initAuth() {
    _auth0Client = await createAuth0Client({
      domain: AUTH0_DOMAIN,
      client_id: AUTH0_CLIENTID,
      audience: AUTH0_AUDIENCE,
    });
    resolveAuth0Client(_auth0Client);
    setAuth0Client?.(_auth0Client);
    const query = window.location.search;
    if (query.includes('code=') && query.includes('state=')) {
      await _auth0Client.handleRedirectCallback();
      authChanged.update((n) => n + 1);
      const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
      window.history.replaceState({}, '', cleanUrl || '/');
    } else if (window.location.search === '?logout') {
      const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
      window.history.replaceState({}, '', cleanUrl || '/');
    }
  }

  const script = document.createElement('script');
  script.onload = initAuth;
  script.async = true;
  script.src = `https://cdn.auth0.com/js/auth0-spa-js/1.13/auth0-spa-js.${
    IS_PRODUCTION ? 'production' : 'development'
  }.js`;
  document.head.appendChild(script);
}

export const isAuthenticated = derived(
  [auth0Client, authChanged],
  ([$auth0Client], set) => {
    if ($auth0Client) {
      $auth0Client
        .isAuthenticated()
        .then(set)
        .catch(() => {
          // TODO log error
          set(false);
        });
    } else {
      set(undefined);
    }
  },
);

export const user = derived(
  [auth0Client, isAuthenticated],
  ([$auth0Client, $isAuthenticated], set) => {
    if ($auth0Client && $isAuthenticated) {
      $auth0Client
        .getUser()
        .then(set)
        .catch(() => {
          // TODO log error
          set(null);
        });
    } else {
      set(null);
    }
  },
);

export const authToken = derived(
  [auth0Client, isAuthenticated],
  ([$auth0Client, $isAuthenticated], set) => {
    if ($auth0Client && $isAuthenticated) {
      $auth0Client
        .getTokenSilently()
        .then(set)
        .catch(() => {
          // TODO log error
          set(null);
        });
    } else {
      set(null);
    }
  },
);

function makeRedirectUri(extraQuery) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${extraQuery ? `?${extraQuery}` : ''}`;
}

export async function login(popup = false) {
  const $auth0Client = get(auth0Client);
  if (!$auth0Client) return;
  const res = await $auth0Client[
    popup ? 'loginWithPopup' : 'loginWithRedirect'
  ]({
    redirect_uri: makeRedirectUri(),
  });
  if (popup) {
    authChanged.update((n) => n + 1);
  }
  return res;
}

export function logout() {
  const $auth0Client = get(auth0Client);
  if (!$auth0Client) return;
  $auth0Client.logout({
    returnTo: makeRedirectUri('logout'),
  });
}
