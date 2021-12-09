<script>
  import * as proma from '@proma/core';
  import eq from 'fast-deep-equal';
  import {
    ChipBoardView,
    Overlay,
    createShortcutDispatcher,
  } from '@proma/svelte-components';
  import PromaChipRegistry from './PromaChipRegistry.svelte';

  export let id = 'PromaFile';
  export let source;

  //
  // Data
  //

  $: sourceJson = source && JSON.parse(source);

  let sourceChip;
  let chipEditor;

  $: updateChipEditor(sourceJson);

  async function updateChipEditor(sourceJson) {
    // TODO better check to see if soruce changed. maybe just check URI?
    if (
      !sourceJson ||
      (chipEditor && eq(chipEditor.Chip.toJSON(), sourceJson))
    ) {
      return;
    }
    proma
      .fromJSON(proma.chip, sourceJson, {
        withErrors: (errors) => {
          console.error(errors);
        },
      })
      .then((resChip) => {
        sourceChip = resChip;
        chipEditor = sourceChip && proma.edit(sourceChip);
      })
      .catch((err) => {
        console.error('here', err);
      });
  }

  export function getEditedSource() {
    return JSON.stringify(chipEditor.Chip.toJSON());
  }

  //
  // Shortcuts
  //

  const actionTarget = {
    getEditedSource,
  };

  const dispatchShortcut = createShortcutDispatcher([
    {
      id,
      select: (e) => {
        return !!e.path.find((el) => el.id === id);
      },
      present: actionTarget,
    },
  ]);

  //
  // Sub-chip request
  //

  let newSubChipRequest;

  $: subChipContextList = newSubChipRequest
    ? [
        ...(newSubChipRequest.fromType &&
        newSubChipRequest.fromType.definitionKind === 'function'
          ? [newEventChipFromType(newSubChipRequest.fromType)]
          : []),
        ...Object.values(newSubChipRequest.chip.customChipClasses),
      ]
    : [];

  function newEventChipFromType(functionType) {
    const ports = functionType.argumentsTypes.map((t, i) => ({
      name: t.label || `arg${i + 1}`,
      type: t.signature,
    }));
    const CustomEventChip = proma.event('CustomEvent', ...ports);
    return CustomEventChip;
  }

  //
  // Event handler
  //

  function handleChipRequest(e) {
    newSubChipRequest = e.detail;
  }
</script>

{#if sourceChip}
  <div class="PromaFile" {id} on:keydown={dispatchShortcut}>
    <ChipBoardView
      chip={sourceChip}
      edit={chipEditor}
      on:subChip:request={handleChipRequest}
    />

    <slot chip={sourceChip} edit={chipEditor} {actionTarget} />

    {#if newSubChipRequest}
      <Overlay
        anchor={{
          x: newSubChipRequest.clientX - 5,
          y: newSubChipRequest.clientY - 5,
        }}
        on:dismiss={() => (newSubChipRequest = null)}
      >
        <PromaChipRegistry
          registry={chipEditor.registry}
          contextChips={subChipContextList}
          on:close={() => (newSubChipRequest = null)}
          on:select={(e) => {
            const chipClass = e.detail.chip;
            newSubChipRequest.provideChipInstance(new chipClass());
            newSubChipRequest = null;
          }}
        />
      </Overlay>
    {/if}
  </div>
{/if}

<style>
  .PromaFile {
    position: relative;
    height: 100%;
  }
</style>
