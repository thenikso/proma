import { writable, readable, derived, get } from 'svelte/store';
import { history } from './history';

/* global: AUTH0_DOMAIN, AUTH0_CLIENTID, createAuth0Client */

let _auth0Client;
let setAuth0Client;
export const auth0Client = readable(null, (set) => {
  setAuth0Client = set;
  if (_auth0Client) {
    set(_auth0Client);
  }
});

if (AUTH0_DOMAIN && AUTH0_CLIENTID) {
  const script = document.createElement('script');
  script.onload = async function () {
    _auth0Client = await createAuth0Client({
      domain: AUTH0_DOMAIN,
      client_id: AUTH0_CLIENTID,
    });
    setAuth0Client?.(_auth0Client);
    initAuth(_auth0Client);
  };
  script.async = true;
  script.src = `https://cdn.auth0.com/js/auth0-spa-js/1.13/auth0-spa-js.${
    IS_PRODUCTION ? 'production' : 'development'
  }.js`;
  document.head.appendChild(script);
}

async function initAuth(client) {
  const $auth0Client = client || get(auth0Client);
  if (!$auth0Client) {
    throw new Error('Auth0 client not initialized');
  }
  const query = window.location.search;
  if (query.includes('code=') && query.includes('state=')) {
    await $auth0Client.handleRedirectCallback();
    authChanged.update((n) => n + 1);
    history.replace(window.location.hash?.substr(1) || '/');
  } else if (window.location.search === '?logout') {
    history.replace(window.location.hash?.substr(1) || '/');
  }
}

const authChanged = writable(0);

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

export const token = derived(
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
  const { origin, pathname, search } = window.location;
  return `${origin}${extraQuery ? `?${extraQuery}` : ''}#${pathname}${search}`;
}

export async function login() {
  const $auth0Client = get(auth0Client);
  if (!$auth0Client) return;
  return $auth0Client.loginWithRedirect({
    redirect_uri: makeRedirectUri(),
  });
}

export function logout() {
  const $auth0Client = get(auth0Client);
  if (!$auth0Client) return;
  $auth0Client.logout({
    returnTo: makeRedirectUri('logout'),
  });
}
