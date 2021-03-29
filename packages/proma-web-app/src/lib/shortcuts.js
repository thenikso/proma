import { browser } from '$app/env';
import { onMount } from 'svelte';
import {
  createShortcutDispatcher,
  shortcuts,
  action,
} from '$lib/components';

//
// Shortcuts
//

if (browser) {
  shortcuts.set('!cmd+S', action('CurrentProject.save'));
  shortcuts.set('[ChipBoard:board] cmd+A', action('ChipBoard.selectAll'));
  shortcuts.set('[ChipBoard:chip] backspace', action('ChipBoard.removeChip'));
  shortcuts.set(
    '[ChipBoard:port] alt+click',
    action('ChipBoard.removeConnection'),
  );
  // TODO make this like `action('CurrentProject.save', 'PromaFile.runRemote')`
  shortcuts.set('[PromaFile] cmd+enter', action('PromaFile.runRemote'));
  shortcuts.set('[PromaFile] cmd+shift+enter', action('PromaFile.runLocal'));
  shortcuts.set(
    '[PromaFile] cmd+shift+alt+enter',
    action('PromaFile.runLocalCompiled'),
  );
}

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
