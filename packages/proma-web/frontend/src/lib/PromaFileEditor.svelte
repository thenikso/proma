<script context="module">
  import { action } from '@proma/svelte-components';

  action.provide('PromaFile.runRemote', ({ target: promaFile }) => {
    promaFile.runRemote();
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
  import PromaChipRegistry from './PromaChipRegistry.svelte';

  export let id = 'PromaFile';
  export let source;
  export let remoteRunUrl = '';

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

  export function getEditedSource() {
    return JSON.stringify(chipEditor.Chip.toJSON());
  }

  //
  // Running
  //

  let runPromise;

  // TODO build with local test payload
  $: runUrl = remoteRunUrl + '?name=nico';

  export function runLocal(compiled) {
    if (!sourceChip) return;

    runPromise = new Promise(async (resolve) => {
      let chipClassToUse = sourceChip;
      if (compiled) {
        console.log(sourceChip.compile());
        chipClassToUse = await sourceChip.compiledClass(null, (url) => {
          if (/fast-deep-equal/.test(url)) {
            return eq;
          }
          return import(url).catch((e) => {
            console.warn(`Could not load module: ${url}`);
            return Promise.reject(e);
          });
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

  export function runRemote() {
    if (!remoteRunUrl) return;

    let url = runUrl;

    // TODO method, body from local test payload
    runPromise = fetch(url).then((res) => res.json());
    return runPromise;
  }

  export function clearRun() {
    runPromise = null;
  }

  //
  // Shortcuts
  //

  const actionTarget = {
    getSource: getEditedSource,
    runLocal,
    runRemote,
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
      <PromaChipRegistry
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

  <slot {sourceChip} {runLocal} {runPromise} {runUrl} {clearRun} />
</div>

<style>
  .PromaFile {
    height: 100%;
  }
</style>
