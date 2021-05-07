<script>
  import FileTree from '$lib/components/FileTree.svelte';

  const files = [
    'www/intex.html',
    'readme.md',
    'endpoints/greet.proma',
    'www/imgs/image.png',
  ];

  let selectedFile;
  let expandedFolders = [];

  function handleFileClick(e) {
    const { file, folder } = e.detail;
    if (file) {
      selectedFile = file;
    } else {
      if (expandedFolders.some((s) => s.startsWith(folder))) {
        expandedFolders = expandedFolders.filter(
          (s) => !s.startsWith(folder + '/') && s !== folder,
        );
      } else {
        expandedFolders = [...expandedFolders, folder];
      }
    }
  }
</script>

<main>
  <div class="sidebar">
    <div class="PreviewTitle">
      <div class="spacer" />
      <h1>Proma <span class="sub">Preview</span></h1>
    </div>
    <div class="FileExplorer">
      <FileTree
        {files}
        expand={expandedFolders}
        select={selectedFile}
        on:click={handleFileClick}
      />
    </div>
    <div class="ProjectTools">
      tools
    </div>
  </div>
  <div class="Logo">
    <img src="/images/logo.webp" alt="Proma" style="height: 100%" />
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

  .Logo {
    z-index: 10;
    position: absolute;
    top: 0;
    left: 0;
    padding: 8px;
    height: 60px;
  }

  .sidebar {
    flex: 0 0 256px;

    width: 256px;
    display: flex;
    flex-direction: column;
    align-items: center;

    background-color: var(--proma-panel--background-color, #fbfdfe);
    box-shadow: 1px 0 3px var(--proma-panel--shadow-color, #eaedf0);
    z-index: 1;
  }

  .PreviewTitle {
    display: flex;
    align-items: center;

    flex-shrink: 0;
    width: 100%;
    height: 60px;
  }

  .PreviewTitle .spacer {
    width: 60px;
  }

  .PreviewTitle h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 500;
  }

  .PreviewTitle h1 .sub {
    font-weight: 300;
    font-size: 0.8em;
  }

  .FileExplorer {
    flex-grow: 1;

    box-sizing: border-box;
    width: calc(100% - 16px);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    background-color: white;
  }

  .ProjectTools {
    width: 100%;
    padding: 8px;
  }
</style>
