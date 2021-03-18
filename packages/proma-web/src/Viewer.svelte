<script>
  import { onMount, createEventDispatcher } from 'svelte';
  // TODO used compiled version instead
  import * as proma from '@proma/core/core/index.mjs';
  import {
    createShortcutDispatcher,
    shortcuts,
    action,
  } from '@proma/web-controls';
  import Overlay from './components/Overlay.svelte';
  import ChipView from './ChipView.svelte';
  import OutletsDetails from './OutletsDetails.svelte';
  import SubChipDetails from './SubChipDetails.svelte';
  import DEFAULT_CHIP from './defaultChip';

  export let source;

  //
  // Events
  //

  const dispatch = createEventDispatcher();

  function dispatchSave(detail) {
    dispatch('save', detail);
  }

  //
  // Chip loading
  //

  $: chipClass =
    source &&
    proma.fromJSON(proma.chip, source, (errors) => {
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
    haveOutletSelected = chips.length === 0 && outlets.length > 0;
    selectedSubChipId =
      chips.length === 1 && outlets.length === 0 ? chips[0] : null;
  }

  function handleSave() {
    dispatchSave({
      chipURI: chipClass.URI,
      chipSource: chipClass.toJSON(),
    });
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

<div class="Viewer">
  <ChipView
    id="MainBoard"
    chip={chipClass}
    on:subChip:request={handleChipRequest}
    on:selection:change={handleSelectionChange}
  />

  <div class="Header">
    <div class="Breadcrumbs">
      <div class="current">{chipClass.URI}</div>
    </div>
    <div class="Spacer" />
    <div class="Tools">
      <button type="button" class="BigButton" on:click={runChipInstance}
        >Run</button
      >

      <input type="checkbox" bind:checked={useCompiled} />

      <button type="button" class="ImageButton" on:click={handleSave}>
        <img src="/images/save.svg" alt="save" />
      </button>

      <div class="old-tools">
        <div>
          <button
            type="button"
            on:click={() => console.log(chipClass.toJSON())}
          >
            Print JSON
          </button>
          <button
            type="button"
            on:click={() => console.log(chipClass.compile())}
          >
            Print code
          </button>
        </div>
      </div>
    </div>
  </div>

  {#if haveOutletSelected || selectedSubChipId}
    <div class="Details">
      <div style="flex-grow: 2">
        {#if haveOutletSelected}
          <OutletsDetails chip={chipClass} />
        {:else if selectedSubChipId}
          <SubChipDetails chip={chipClass} subChipId={selectedSubChipId} />
        {/if}
      </div>
    </div>
  {/if}

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
</div>

<style>
  .BigButton {
    border: none;
    border-radius: 5px;
    padding: 15px 45px;
    font-size: 20px;
    cursor: pointer;

    background: #fe9d28;
    color: white;
    font-weight: 500;
  }

  .ImageButton {
    border: none;
    background: transparent;
    cursor: pointer;
    height: 25px;
  }

  .ImageButton > img {
    height: 100%;
  }

  /* Viewer */

  .Viewer {
    position: relative;
    width: 100%;
    height: 100%;

    flex-grow: 1;
  }

  /* Header */

  .Header {
    box-sizing: border-box;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100px;
    padding: 30px;

    display: flex;
    align-items: center;

    transition: background-color 0.25s ease;

    pointer-events: none;
  }

  .Header:hover {
    transition: background-color 1s ease;
    transition-delay: 0.5s;
    background-color: rgba(255, 255, 255, 0.5);
  }

  .Header .Breadcrumbs {
    pointer-events: all;
  }

  .Header .Breadcrumbs .current {
    font-size: 1.5em;
    font-weight: 500;
    color: #2e3741;
  }

  .Header .Spacer {
    flex-grow: 1;
  }

  .Header .Tools {
    pointer-events: all;

    display: flex;
    flex-direction: row-reverse;
    align-items: center;
  }

  /* Details */

  .Details {
    box-sizing: border-box;
    position: absolute;
    right: 30px;
    top: 110px;
    padding: 20px;
    width: 350px;
    max-height: calc(100% - 160px);

    background-color: var(
      --proma-board--chip-selected--background-color,
      #3e3e3e
    );
    border-width: 2px;
    border-style: solid;
    border-color: var(--proma-board--chip--border-color, #1d1d1d);
    border-radius: 5px;
    box-shadow: var(
      --proma-board--chip--shadow,
      0 2px 1px rgba(29, 29, 29, 0.8)
    );

    display: flex;
    flex-direction: column;
  }
</style>
