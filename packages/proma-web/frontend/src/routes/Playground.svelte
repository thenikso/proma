<script>
  import jszip from 'jszip';
  import { saveAs } from 'file-saver';
  import FileTree from '$lib/components/FileTree.svelte';

  const files = {
    'readme.md': 'Hello world!',
  };

  //
  // File explorer
  //

  $: fileNames = Object.keys(files);

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

  //
  // Download project
  //

  let currentDownload;

  function download(files) {
    // TODO loading
    const zip = new jszip();
    // TODO use folder for all with project name
    for (const [fileName, fileContent] of Object.entries(files)) {
      zip.file(fileName, fileContent);
    }
    return zip.generateAsync({ type: 'blob' }).then((blob) => {
      // TODO use project name
      return saveAs(blob, 'project.zip');
    });
  }

  function handleDownloadClick() {
    if (currentDownload) return;
    currentDownload = download(files).then(() => {
      currentDownload = null;
    });
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
        files={fileNames}
        expand={expandedFolders}
        select={selectedFile}
        on:click={handleFileClick}
      />
    </div>
    <div class="ProjectTools">
      <button
        type="button"
        class="button"
        on:click={handleDownloadClick}
        disabled={!!currentDownload}
      >
        Download
      </button>
      <button type="button" class="button primary">Take survey</button>
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
    padding: 8px 8px 0 8px;

    display: flex;
    flex-direction: column;
  }
</style>
