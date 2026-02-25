import { get } from 'svelte/store';
import { authInitialized } from './stores/auth';

/* gloabl: BACKEND_ENDPOINT */

export async function fetchApi(url, options) {
  const config = Object.assign(
    {
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
    },
    options,
  );
  if (!options?.noAuth) {
    const authClient = await authInitialized;
    const token = await authClient.getTokenSilently().catch(() => null);
    if (options?.noAuth === false && !token) {
      throw new Error('Not authenticated');
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  if (options?.body && typeof options.body !== 'string') {
    config.body = JSON.stringify(options.body);
  }
  if (url.startsWith('/')) {
    url = BACKEND_ENDPOINT + url;
  }
  const response = await fetch(url, config);
  const res = await response.json();
  if (!response.ok) {
    throw new Error(res.error);
  }
  return res;
}
