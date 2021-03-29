<script context="module">
  // TODO add run actions
  import { action } from '@proma/svelte-components';

  action.provide('PromaFile.runRemote', ({ target: promaFile }) => {
    console.log('run remote', promaFile);
  });

  action.provide('PromaFile.runLocal', ({ target: promaFile }) => {
    promaFile.runLocal();
  });

  action.provide('PromaFile.runLocalCompiled', ({ target: promaFile }) => {
    promaFile.runLocal(true);
  });
</script>

<script>
  import * as proma from '@proma/core';
  import eq from 'fast-deep-equal';
  import {
    ChipBoardView,
    Overlay,
    createShortcutDispatcher,
  } from '@proma/svelte-components';

  export let id = 'PromaFile';
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

  function getSource() {
    return JSON.stringify(chipEditor.Chip.toJSON());
  }
  $: if (chipEditor) {
    getEditedSource = getSource;
  }

  //
  // Running
  //

  let runPromise;

  function runLocal(compiled) {
    if (!sourceChip) return;

    runPromise = new Promise(async (resolve) => {
      let chipClassToUse = sourceChip;
      if (compiled) {
        console.log(sourceChip.compile());
        chipClassToUse = await sourceChip.compiledClass(null, (url) => {
          if (/fast-deep-equal/.test(url)) {
            return eq;
          }
          return import(url);
        });
      } else {
        console.log(sourceChip.toJSON());
      }

      // TODO set parameters somewhere else
      const chipInstance = new chipClassToUse({
        httpMethod: 'GET',
        queryStringParameters: {
          name: 'test',
        },
      });

      chipInstance.out.then(() => {
        resolve({
          result: chipInstance.out.result(),
        });
      });
      chipInstance.in.exec();
    });
  }

  function clearRun() {
    runPromise = null;
  }

  //
  // Shortcuts
  //

  const dispatchShortcut = createShortcutDispatcher([
    {
      id,
      select: (e) => {
        return !!e.path.find((el) => el.id === id);
      },
      present: {
        getSource,
        runLocal,
      },
    },
  ]);

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

<div class="PromaFile" {id} on:keydown={dispatchShortcut}>
  <ChipBoardView
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

  <slot {sourceChip} {runLocal} {runPromise} {clearRun} />
</div>

<style>
  .PromaFile {
    height: 100%;
  }
</style>
