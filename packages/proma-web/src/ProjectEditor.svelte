<script>
  import Viewer from './Viewer.svelte';

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

  //
  // Event handlers
  //

  let savePromise;
  function handleSaveChip(event) {
    if (savePromise) return;
    const { chipSource } = event.detail;
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
    )
      .then((res) => res.json())
      .finally(() => {
        setTimeout(() => {
          savePromise = null;
        }, 1000);
      });
  }
</script>

<main class="theme-light">
  <div class="MainBar">
    <img src="/images/logo.webp" alt="Proma" style="width: 100%" />
  </div>
  <div class="MainContent">
    {#await projectPromise}
      Loading
    {:then project}
      {#if chipSource}
        <Viewer source={chipSource} on:save={handleSaveChip} />
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
  }
</style>
