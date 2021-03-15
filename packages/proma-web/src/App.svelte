<script>
  import { onMount } from 'svelte';
  // TODO used compiled version instead
  import * as proma from '@proma/core/core/index.mjs';
  import {
    createShortcutDispatcher,
    shortcuts,
    action,
  } from '@proma/web-controls';
  import Overlay from './components/Overlay.svelte';
  import ChipView from './ChipView.svelte';
  import OutletsView from './OutletsView.svelte';
  import SubChipView from './SubChipView.svelte';
  import DEFAULT_CHIP from './defaultChip';

  //
  // Chip loading
  //

  const initChipData = localStorage.getItem('Main');
  const initChipJson =
    (initChipData && JSON.parse(initChipData)) || DEFAULT_CHIP;

  // const chipClass = proma.chip('Main', ({ OnCreate }) => {
  //   // const exec = proma.inputFlow('exec');
  //   const target = proma.inputData('target', { canonical: true });

  //   const onCreate = new OnCreate();
  //   const log = new proma.lib.debug.Log();

  //   proma.wire(onCreate.out.then, log.in.exec);
  //   // proma.wire(exec, log.in.exec);
  //   proma.wire(target, log.in.message);
  // });
  const chipClass = proma.fromJSON(proma.chip, initChipJson, (errors) => {
    for (const e of errors) {
      console.log(e.message);
    }
  });

  //
  // Data
  //

  let targetEl;
  let newSubChipRequest;

  let haveOutletSelected;
  let selectedSubChipId;

  //
  // Shortcuts
  //

  shortcuts.set('!cmd+S', handleSave);
  shortcuts.set('[MainBoard:board] cmd+A', action('ChipView.selectAll'));
  shortcuts.set('[MainBoard:chip] backspace', action('ChipView.removeChip'));
  shortcuts.set(
    '[MainBoard:port] alt+click',
    action('ChipView.removeConnection'),
  );

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

  //
  // Instance run
  //

  let useCompiled = false;
  let chipInstance;

  function runChipInstance() {
    if (chipInstance) {
      chipInstance.destroy();
    }
    if (useCompiled) {
      const code = chipClass.compile();
      const makeCompiledChip = new Function('return (' + code + ')');
      const ChipCompiled = makeCompiledChip();
      chipInstance = new ChipCompiled(targetEl);
    } else {
      chipInstance = new chipClass(targetEl);
    }
  }

  //
  // Listing chips
  //

  let registryList = proma.registry.list();

  function registryListExcluding(chipToExclude) {
    return registryList.filter((c) => c !== chipToExclude);
  }

  //
  // Event handlers
  //

  function handleChipRequest(e) {
    newSubChipRequest = e.detail;
  }

  function handleSelectionChange(e) {
    const { chips, outlets } = e.detail;
    haveOutletSelected = chips.length === 0;
    selectedSubChipId =
      chips.length === 1 && outlets.length === 0 ? chips[0] : null;
  }

  function handleSave() {
    localStorage.setItem(chipClass.URI, JSON.stringify(chipClass.toJSON()));
  }

  //
  // Utils
  //

  function newEventChipFromType(functionType) {
    const ports = functionType.argumentsTypes.map((t, i) => ({
      name: t.label || `arg${i + 1}`,
      type: t.signature,
    }));
    const CustomEventChip = proma.event('CustomEvent', ports);
    return new CustomEventChip();
  }
</script>

<main class="theme-light">
  <div bind:this={targetEl}>
    <h1>Hello!</h1>
    <input type="text" placeholder="What's your name?" />
    <button type="button">Greet me</button>
  </div>
  <ChipView
    id="MainBoard"
    chip={chipClass}
    on:subChip:request={handleChipRequest}
    on:selection:change={handleSelectionChange}
  />
  <div style="display: flex; flex-direction: column;">
    <div style="flex-grow: 2">
      {#if haveOutletSelected}
        <OutletsView chip={chipClass} />
      {:else if selectedSubChipId}
        <SubChipView chip={chipClass} subChipId={selectedSubChipId} />
      {/if}
    </div>
    <footer style="padding: 5px;">
      <div style="margin-bottom: 10px;">
        <button type="button" on:click={runChipInstance}>Run</button>
        <label>
          <input type="checkbox" bind:checked={useCompiled} />
          compiled
        </label>
      </div>
      <div>
        <button type="button" on:click={() => console.log(chipClass.toJSON())}>
          Print JSON
        </button>
        <button type="button" on:click={() => console.log(chipClass.compile())}>
          Print code
        </button>
        <button type="button" on:click={handleSave}>Save</button>
      </div>
    </footer>
  </div>
</main>

{#if newSubChipRequest}
  <Overlay
    anchor={{
      x: newSubChipRequest.clientX - 5,
      y: newSubChipRequest.clientY - 5,
    }}
    on:dismiss={() => (newSubChipRequest = null)}
  >
    <div>
      {#if newSubChipRequest.fromType && newSubChipRequest.fromType.definitionKind === 'function'}
        <button
          type="button"
          on:click={() => {
            newSubChipRequest.provideChipInstance(
              newEventChipFromType(newSubChipRequest.fromType),
              // TODO also send connection hint
            );
            newSubChipRequest = null;
          }}
        >
          Create custom event
        </button>
      {/if}
      <div><b>Context chips</b></div>
      {#each Object.values(newSubChipRequest.chip.customChipClasses) as chipClass (chipClass.URI)}
        <div>
          <button
            type="button"
            on:click={() => {
              newSubChipRequest.provideChipInstance(new chipClass());
              newSubChipRequest = null;
            }}
          >
            {chipClass.URI}
          </button>
        </div>
      {/each}
      <div><b>All chips</b></div>
      {#each registryListExcluding(newSubChipRequest.chip) as chipClass (chipClass.URI)}
        <div>
          <button
            type="button"
            on:click={() => {
              newSubChipRequest.provideChipInstance(new chipClass());
              newSubChipRequest = null;
            }}
          >
            {chipClass.URI}
          </button>
        </div>
      {/each}
    </div>
  </Overlay>
{/if}

<style>
  main {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;

    display: grid;
    grid-template-columns: 1fr 2fr 300px;
    grid-template-rows: 1fr;
  }
</style>
