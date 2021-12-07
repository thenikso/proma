<script context="module">
  import { action } from '@proma/svelte-components';

  action.provide('PromaFile.runRemote', async ({ target: promaFile }) => {
    await action('CurrentProject.save')();
    return promaFile.runRemote();
  });

  action.provide('PromaFile.runLocal', ({ target: promaFile }) => {
    return promaFile.runLocal();
  });

  action.provide('PromaFile.runLocalCompiled', ({ target: promaFile }) => {
    return promaFile.runLocal(true);
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
    getEditedSource,
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

{#if sourceChip}
  <div class="PromaFile" {id} on:keydown={dispatchShortcut}>
    <ChipBoardView
      chip={sourceChip}
      edit={chipEditor}
      on:subChip:request={handleChipRequest}
    />

    <slot
      chip={sourceChip}
      edit={chipEditor}
      {runLocal}
      {runPromise}
      {runUrl}
      {clearRun}
      {actionTarget}
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
