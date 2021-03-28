<script context="module">
  import { action } from '@proma/svelte-components';

  export async function load({ page, fetch, session, context }) {
    const { hostId, projectSlug } = page.params;

    const project = await fetch(`/edit/${hostId}/${projectSlug}`, {
      headers: {
        accept: 'application/json',
      },
    }).then((res) => res.json());

    const selectedFilePath = page.query.get('file');
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

  action.provide('CurrentProject.save', async () => {
    if (!getCurrentProjectToSave) return;
    const projectToSave = getCurrentProjectToSave();
    if (!projectToSave) return;
    savingPromise = await fetch(
      `/edit/${projectToSave.ownerHostId}/${projectToSave.projectSlug}`,
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
</script>

<script>
  import { browser } from '$app/env';
  import { keyMods } from '$lib/stores/keyMods';
  import PromaFileEditor from '$lib/PromaFileEditor.svelte';
  import PromaRunView from '$lib/PromaRunView.svelte';

  export let project;
  export let selectedFilePath;

  $: selectedFileType =
    browser && ((selectedFilePath || '').match(/\.(.+)$/) || [])[1];
  $: selectedFileSource =
    browser && atob(project?.files?.[selectedFilePath] || '');

  // Will be initalized as a function to save the selected file source
  let getFileEditedSource;

  $: getCurrentProjectToSave =
    getFileEditedSource &&
    function projectToSave() {
      const selectedFileContent = btoa(getFileEditedSource());
      project.files[selectedFilePath] = selectedFileContent;
      return project;
    };

  const save = action('CurrentProject.save');
  let isSaving;

  function handleSaveClick() {
    if (isSaving) return;
    isSaving = save().then(() =>
      setTimeout(() => {
        isSaving = null;
      }, 1000),
    );
  }
</script>

<div class="Editor Editor-fileType-{selectedFileType}">
  {#if typeof window !== 'undefined'}
    {#if selectedFileType === 'proma'}
      <PromaFileEditor
        source={selectedFileSource}
        bind:getEditedSource={getFileEditedSource}
      />
    {:else}
      <div>Unsupported file type "${selectedFileType}"</div>
    {/if}
  {/if}

  <div class="EditorHeader">
    <div class="Breadcrumbs">
      <div class="current">{selectedFilePath}</div>
    </div>
    <div class="Spacer" />
    <div class="Tools">
      <!-- TODO switch by selectedFileType -->
      <button type="button" class="Tools-Run">
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

  <div class="RunPanel">
    <PromaRunView />
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

  /* Run panel */

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
