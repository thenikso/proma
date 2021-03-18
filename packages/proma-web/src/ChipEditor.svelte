<script>
  // TODO used compiled version instead
  import * as proma from '@proma/core/core/index.mjs';
  import Overlay from './components/Overlay.svelte';
  import ChipBoard from './ChipBoard.svelte';
  import OutletsDetails from './OutletsDetails.svelte';
  import SubChipDetails from './SubChipDetails.svelte';
  import DEFAULT_CHIP from './defaultChip';

  export let chipClass;
  // Show selected sub-chip or outlet details on panel
  export let showDetails = false;

  //
  // Data
  //

  let targetEl;
  let newSubChipRequest;

  let haveOutletSelected;
  let selectedSubChipId;

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
    if (!showDetails) return;
    const { chips, outlets } = e.detail;
    haveOutletSelected = chips.length === 0 && outlets.length > 0;
    selectedSubChipId =
      chips.length === 1 && outlets.length === 0 ? chips[0] : null;
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

<div class="ChipEditor">
  <ChipBoard
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
    {#if $$slots.tools}
      <div class="Tools">
        <slot name="tools" />
      </div>
    {/if}
  </div>

  {#if haveOutletSelected || selectedSubChipId}
    <div class="Details SelectionDetails">
      {#if haveOutletSelected}
        <OutletsDetails chip={chipClass} />
      {:else if selectedSubChipId}
        <SubChipDetails chip={chipClass} subChipId={selectedSubChipId} />
      {/if}
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
  /* ChipEditor */

  .ChipEditor {
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
    background-color: rgba(255, 255, 255, 0.7);
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
  }

  /* Details */

  .Details {
    right: 30px;
    top: 110px;
    height: 100%;

    box-sizing: border-box;
    position: absolute;
    padding: 20px;
    width: 350px;
    max-height: calc(100% - 140px);

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

  .Details.SelectionDetails {
    left: 30px;
    bottom: 30px;
    height: auto;
  }
</style>
