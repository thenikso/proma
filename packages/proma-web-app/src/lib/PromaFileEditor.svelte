<script>
  // TODO use compiled library
  import * as proma from '@proma/core';
  import { ChipBoardView, Overlay } from '@proma/svelte-components';

  export let source;
  export let getEditedSource = undefined;

  //
  // Data
  //

  let expectedSource;
  if (expectedSource !== source) {
    expectedSource = source;
  }

  $: sourceJson = expectedSource && JSON.parse(expectedSource);
  $: sourceChip =
    sourceJson &&
    proma.fromJSON(proma.chip, sourceJson, (errors) => {
      console.error(errors);
    });
  $: chipEditor = sourceChip && proma.edit(sourceChip);

  $: if (chipEditor) {
    getEditedSource = function getSource() {
      return JSON.stringify(chipEditor.Chip.toJSON());
    };
  }

  //
  // Sub-chip request
  //

  let newSubChipRequest;
  let registryList = proma.registry.list();

  function registryListExcluding(chipToExclude) {
    return registryList.filter((c) => c !== chipToExclude);
  }

  function newEventChipFromType(functionType) {
    const ports = functionType.argumentsTypes.map((t, i) => ({
      name: t.label || `arg${i + 1}`,
      type: t.signature,
    }));
    const CustomEventChip = proma.event('CustomEvent', ...ports);
    return new CustomEventChip();
  }

  //
  // Event handler
  //

  function handleChipRequest(e) {
    newSubChipRequest = e.detail;
  }
</script>

<ChipBoardView
  id="PromaFile"
  chip={sourceChip}
  edit={chipEditor}
  on:subChip:request={handleChipRequest}
/>

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
