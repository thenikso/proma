<script context="module">
  export async function load({ page, fetch, session, context }) {
    const { hostId, projectSlug } = page.params;

    const project = await fetch(`/edit/${hostId}/${projectSlug}`, {
      headers: {
        accept: 'application/json',
      },
    }).then((res) => res.json());

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
</script>

<script>
  import '$lib/ssr-polyfills';
  import PromaFileEditor from '$lib/PromaFileEditor.svelte';

  export let project;
  export let selectedFilePath;

  $: selectedFileType = ((selectedFilePath || '').match(/\.(.+)$/) || [])[1];
  $: selectedFileSource = atob(project?.files?.[selectedFilePath] || '');

  // Will be initalized as a function to save the selected file source
  let getFileEditedSource;
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
      <div class="current">Title</div>
    </div>
    <div class="Spacer" />
    {#if $$slots.tools}
      <div class="Tools">
        <slot name="tools" />
      </div>
    {/if}
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

  .EditorHeader .Tools {
    pointer-events: all;
  }
</style>
