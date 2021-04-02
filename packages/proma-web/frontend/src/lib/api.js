import { get } from 'svelte/store';
import { authToken } from './stores/auth';

/* gloabl: BACKEND_ENDPOINT */

export async function fetchApi(url, options) {
  const config = Object.assign(
    {
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        accept: 'application/json',
        ...(options?.headers || {}),
      },
    },
    options,
  );
  const token = get(authToken);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (options?.body && typeof options.body !== 'string') {
    config.body = JSON.stringify(options.body);
  }
  if (url.startsWith('/')) {
    url = BACKEND_ENDPOINT + url;
  }
  const response = await fetch(url, config);
  const res = await response.json();
  return res;
}
