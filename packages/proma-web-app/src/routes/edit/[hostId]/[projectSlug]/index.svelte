<script context="module">
  import { browser } from '$app/env';
  import { action } from '@proma/svelte-components';

  export async function load({ page, fetch, session, context }) {
    const { hostId, projectSlug } = page.params;

    const project = await fetch(
      `http://localhost:4000/dev/project/${hostId}/${projectSlug}`,
      {
        headers: {
          accept: 'application/json',
        },
      },
    ).then((res) => res.json());

    let selectedFilePath = page.query.get('file');
    if (!selectedFilePath) {
      selectedFilePath = Object.keys(project.files)[0];
    }

    return {
      props: {
        project,
        selectedFilePath,
      },
    };
  }

  // TODO this should probably be in a store

  let getCurrentProjectToSave;
  let savingPromise;

  if (browser) {
    action.provide('CurrentProject.save', async () => {
      if (!getCurrentProjectToSave) return;
      const projectToSave = getCurrentProjectToSave();
      if (!projectToSave) return;
      savingPromise = await fetch(
        `http://localhost:4000/dev/project/${projectToSave.ownerHostId}/${projectToSave.projectSlug}`,
        {
          method: 'post',
          headers: {
            accept: 'application/json',
          },
          body: JSON.stringify(projectToSave),
        },
      ).then((res) => res.json());
      return savingPromise;
    });
  }
</script>

<script>
  import { keyMods } from '$lib/stores/keyMods';
  import PromaFileEditor from '$lib/PromaFileEditor.svelte';
  import PromaRunView from '$lib/PromaRunView.svelte';

  export let project;
  export let selectedFilePath;

  $: selectedFileName =
    browser &&
    ((selectedFilePath || '').match(/(?<=\/|^)([^.\/]+)\..+$/) || [])[1];
  $: selectedFileExt =
    browser && ((selectedFilePath || '').match(/\.(.+)$/) || [])[1];
  $: selectedFileSource =
    browser && atob(project?.files?.[selectedFilePath] ?? '');
  $: selectedFileRunUrl = `http://localhost:4000/dev/run/${project.ownerHostId}/${project.projectSlug}/${selectedFileName}`;

  let editor;

  //
  // Saving
  //

  $: getCurrentProjectToSave =
    editor &&
    function projectToSave() {
      const selectedFileContent = btoa(editor.getEditedSource());
      project.files[selectedFilePath] = selectedFileContent;
      return project;
    };

  const save = browser && action('CurrentProject.save');
  let isSaving;

  function handleSaveClick() {
    if (isSaving) return;
    isSaving = save().then(() =>
      setTimeout(() => {
        isSaving = null;
      }, 1000),
    );
  }

  //
  // Running
  //

  function handleRun(e) {
    if (e.metaKey && e.shiftKey && e.altKey) {
      editor.runLocal(true);
    } else if (e.metaKey && e.shiftKey) {
      editor.runLocal();
    } else {
      editor.runRemote();
    }
  }
</script>

<div class="Editor Editor-fileType-{selectedFileExt}">
  {#if typeof window !== 'undefined'}
    {#if selectedFileExt === 'proma'}
      <PromaFileEditor
        bind:this={editor}
        source={selectedFileSource}
        remoteRunUrl={selectedFileRunUrl}
        let:runPromise
        let:clearRun
        let:runUrl
        let:actionTarget
      >
        {#if runPromise}
          <div class="RunPanel">
            <PromaRunView
              url={runUrl}
              results={runPromise}
              on:close={clearRun}
            />
          </div>
        {/if}
      </PromaFileEditor>
    {:else}
      <div>Unsupported file type "${selectedFileExt}"</div>
    {/if}
  {/if}

  <div class="EditorHeader">
    <div class="Breadcrumbs">
      <div class="current">{selectedFilePath}</div>
    </div>
    <div class="Spacer" />
    <div class="Tools">
      <!-- TODO switch by selectedFileExt -->
      <button type="button" class="Tools-Run" on:click={handleRun}>
        {#if $keyMods.metaKey && $keyMods.shiftKey && $keyMods.altKey}
          <span>Test</span> <small>compiled</small>
        {:else if $keyMods.metaKey && $keyMods.shiftKey}
          <span>Test</span>
        {:else}
          <span>Run</span>
        {/if}
      </button>

      <button
        type="button"
        class="Tools-Save"
        on:click={handleSaveClick}
        disabled={isSaving}
      >
        <img src="/images/save.svg" alt="save" />
      </button>
    </div>
  </div>
</div>

<style>
  .Editor {
    position: relative;
    width: 100%;
    height: 100%;
  }

  /* Header */

  .EditorHeader {
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

  .EditorHeader:hover {
    transition: background-color 1s ease;
    transition-delay: 0.5s;
    background-color: rgba(255, 255, 255, 0.7);
  }

  .EditorHeader .Breadcrumbs {
    pointer-events: all;
  }

  .EditorHeader .Breadcrumbs .current {
    font-size: 1.5em;
    font-weight: 500;
    color: #2e3741;
  }

  .EditorHeader .Spacer {
    flex-grow: 1;
  }

  /* Tools */

  .Tools {
    pointer-events: all;
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
  }

  .Tools > * {
    margin-left: 20px;
  }

  .Tools-Save {
    border: none;
    background: transparent;
    cursor: pointer;
    height: 25px;
    outline: none;
  }

  .Tools-Save:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .Tools-Save > img {
    height: 100%;
  }

  .Tools-Run {
    border: none;
    border-radius: 5px;
    padding: 5px 45px;
    font-size: 20px;
    cursor: pointer;
    height: 60px;

    background: #fe9d28;
    color: white;
    font-weight: 500;
    outline: none;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  /* RunPanel */

  .RunPanel {
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
  }
</style>
