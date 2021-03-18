<script>
  import * as proma from '@proma/core/core/index.mjs';
  import {
    createShortcutDispatcher,
    shortcuts,
    action,
    StringInput,
  } from '@proma/web-controls';
  import { onMount } from 'svelte';
  import ChipEditor from './ChipEditor.svelte';

  export let currentRoute;
  export let params;

  $: hostId = currentRoute.namedParams.hostId;
  $: projectSlug = currentRoute.namedParams.projectSlug || 'default';

  $: projectPromise = fetch(
    `http://localhost:3000/dev/project/${hostId}/${projectSlug}`,
  ).then((res) => res.json());

  let project;
  let selectedFileName;

  $: if (projectPromise) {
    selectedFileName = null;
    projectPromise.then((res) => {
      project = decodeProject(res);
    });
  } else {
    project = null;
  }

  function decodeProject(project) {
    for (const fileName in project.files || {}) {
      let fileSource = atob(project.files[fileName]);
      if (fileName.endsWith('.proma')) {
        if (!selectedFileName) {
          selectedFileName = fileName;
        }
        fileSource = JSON.parse(fileSource);
      }
      project.files[fileName] = fileSource;
    }
    return project;
  }

  $: chipSource =
    project &&
    selectedFileName &&
    selectedFileName.endsWith('.proma') &&
    project.files[selectedFileName];

  $: chipClass =
    chipSource &&
    proma.fromJSON(proma.chip, chipSource, (errors) => {
      for (const e of errors) {
        console.log(e.message);
      }
    });

  //
  // Shortcuts
  //

  shortcuts.set('!cmd+S', saveChip);
  shortcuts.set('[MainBoard:board] cmd+A', action('ChipBoard.selectAll'));
  shortcuts.set('[MainBoard:chip] backspace', action('ChipBoard.removeChip'));
  shortcuts.set(
    '[MainBoard:port] alt+click',
    action('ChipBoard.removeConnection'),
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
  // Saving
  //

  let savePromise;
  function saveChip() {
    if (savePromise) return savePromise;
    const chipSource = chipClass.toJSON();
    savePromise = fetch(
      `http://localhost:3000/dev/project/${hostId}/${projectSlug}`,
      {
        method: 'post',
        body: JSON.stringify({
          ...project,
          files: {
            ...project.files,
            [selectedFileName]: btoa(JSON.stringify(chipSource)),
          },
        }),
      },
    ).then((res) => res.json());

    savePromise.finally(() => {
      setTimeout(() => {
        savePromise = null;
      }, 1000);
    });

    return savePromise;
  }

  //
  // Running
  //

  $: selectedEndpoint =
    selectedFileName &&
    (selectedFileName.match(/^endpoints\/(.+).proma$/i) || [])[1];
  $: runUrl =
    project &&
    selectedEndpoint &&
    `http://localhost:3000/dev/run/${project.ownerHostId}/${project.projectSlug}/${selectedEndpoint}?name=nico`;

  let runPromise;

  async function runRemove() {
    if (!runUrl) return;
    await saveChip();
    runPromise = fetch(runUrl).then((res) => res.json());
    return runPromise;
  }
</script>

<main class="theme-light">
  <div class="MainBar">
    <img src="/images/logo.webp" alt="Proma" style="width: 60px" />
  </div>
  <div class="MainContent">
    {#await projectPromise}
      Loading
    {:then project}
      {#if chipClass}
        <ChipEditor {chipClass}>
          <div class="ChipViewTools" slot="tools">
            <button type="button" class="run-button" on:click={runRemove}>
              Run
            </button>
            <button
              type="button"
              class="save-button"
              on:click={saveChip}
              disabled={!!savePromise}
            >
              <img src="/images/save.svg" alt="save" />
            </button>
          </div>
        </ChipEditor>
        {#if runPromise}
          <section class="RunWindow">
            <header class="navigation">
              <StringInput disabled value={runUrl} />
              <button
                type="button"
                on:click={() => {
                  runPromise = null;
                }}>X</button
              >
            </header>
            {#await runPromise}
              <div>loading...</div>
            {:then res}
              <pre
                class="results">{JSON.stringify(res.result || res.error, null, 2)}</pre>
              {#if res.logs && res.logs.length > 0}
                <pre
                  class="logs">
              {#each res.logs as l}
                {l}
              {/each}
            </pre>
              {/if}
            {:catch err}
              <div>{err.message}</div>
            {/await}
          </section>
        {/if}
      {/if}
    {:catch error}
      <p>{error.message}</p>
    {/await}
  </div>
</main>

<style>
  main {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;

    display: flex;
    flex-direction: row;
  }

  .MainBar {
    flex: 0 0 96px;

    box-sizing: border-box;
    width: 96px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;

    background-color: #fbfdfe;
    box-shadow: 1px 0 3px #eaedf0;
    z-index: 1;
  }

  .MainContent {
    flex-grow: 1;
    position: relative;
  }

  /* Chip tools */

  .ChipViewTools {
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
  }

  .ChipViewTools > * {
    margin-left: 20px;
  }

  .ChipViewTools .run-button {
    border: none;
    border-radius: 5px;
    padding: 15px 45px;
    font-size: 20px;
    cursor: pointer;

    background: #fe9d28;
    color: white;
    font-weight: 500;
    outline: none;
  }

  .ChipViewTools .save-button {
    border: none;
    background: transparent;
    cursor: pointer;
    height: 25px;
    outline: none;
  }

  .ChipViewTools .save-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .ChipViewTools .save-button > img {
    height: 100%;
  }

  /* RunWindow */

  .RunWindow {
    right: 30px;
    top: 110px;
    height: 100%;

    box-sizing: border-box;
    position: absolute;
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

  .RunWindow .navigation {
    padding: 20px;
    border-bottom: 1px solid var(--proma-board--chip--border-color, #1d1d1d);

    display: grid;
    grid-template-columns: 1fr 30px;
    grid-template-rows: 1fr;
    grid-gap: 5px;
  }

  .RunWindow .results {
    flex-grow: 1;
    margin: 0;
    padding: 5px 3px;
    overflow: auto;
  }

  .RunWindow .logs {
    max-height: 40%;
    background-color: #171717;
    border-radius: 4px;
    color: white;
    padding: 5px 3px;
    margin: 0;
    min-height: 100px;
    overflow: auto;
  }
</style>
