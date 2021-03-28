import { browser } from '$app/env';
import { onMount } from 'svelte';
import {
  createShortcutDispatcher,
  shortcuts,
  action,
} from '@proma/svelte-components';

//
// Shortcuts
//

shortcuts.set('!cmd+S', action('CurrentProject.save'));
shortcuts.set('[PromaFile:board] cmd+A', action('ChipBoard.selectAll'));
shortcuts.set('[PromaFile:chip] backspace', action('ChipBoard.removeChip'));
shortcuts.set(
  '[PromaFile:port] alt+click',
  action('ChipBoard.removeConnection'),
);
// shortcuts.set('[PromaFile:board] cmd+enter', runRemote);
// shortcuts.set('[PromaFile:board] cmd+shift+enter', () => runLocal());
// shortcuts.set('[PromaFile:board] cmd+shift+alt+enter', () => runLocal(true));

let shortcutsInitialized = false;

export function initShortcuts() {
  if (shortcutsInitialized || !browser) {
    return;
  }
  shortcutsInitialized = true;

  const dispatchShortcuts = createShortcutDispatcher();

  onMount(() => {
    const preventDefaultShortcuts = (e) => {
      if (dispatchShortcuts(e, { capture: false })) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const preventDefaultShortcutsCaptured = (e) => {
      if (dispatchShortcuts(e, { capture: true })) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', preventDefaultShortcutsCaptured, true);
    document.addEventListener('keydown', preventDefaultShortcuts);

    return () => {
      document.removeEventListener(
        'keydown',
        preventDefaultShortcutsCaptured,
        true,
      );
      document.removeEventListener('keydown', preventDefaultShortcuts);
    };
  });
}
