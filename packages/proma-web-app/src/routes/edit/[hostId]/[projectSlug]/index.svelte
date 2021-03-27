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
