import { readable } from 'svelte/store';
import { browser } from '$app/env';

export const keyMods = readable(
  {
    metaKey: false,
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
  },
  (set) => {
    if (!browser) return;

    const setKeyMods = (e) => {
      set({
        metaKey: e.metaKey,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
      });
    };

    const resetKeyMods = () => {
      set({
        metaKey: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
      });
    };

    document.addEventListener('keydown', setKeyMods, true);
    document.addEventListener('keyup', resetKeyMods, true);

    return () => {
      document.removeEventListener('keydown', setKeyMods, true);
      document.removeEventListener('keyup', resetKeyMods, true);
    };
  },
);
