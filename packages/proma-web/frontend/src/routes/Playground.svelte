<script context="module">
  import { action } from '@proma/svelte-components';

  let saveCurrentPlayground;

  action.provide('Playground.save', () => {
    if (!saveCurrentPlayground) return;
    saveCurrentPlayground();
  });
</script>

<script>
  import * as proma from '@proma/core';
  import jszip from 'jszip';
  import { saveAs } from 'file-saver';
  import { history } from '$lib/stores/history';
  import { page } from '$lib/stores/routing';
  import FileTree from '$lib/components/FileTree.svelte';
  import PromaFileEditor from '$lib/PromaFileEditor.svelte';
  import PromaRunView from '$lib/PromaRunView.svelte';
  import makeBaseProject from '$lib/playground-projects/base';
  import CodeMirror from '$lib/components/CodeMirror.svelte';

  // TODO load from localStorage
  let selectedProjectName = $page.query.project;
  $: selectedProjectDataString =
    selectedProjectName &&
    localStorage.getItem('project-' + selectedProjectName);

  let files;
  $: if (selectedProjectDataString) {
    files = JSON.parse(selectedProjectDataString);
  } else {
    files = makeBaseProject();
  }

  //
  // File Selection
  //

  let selectedFilePath = $page.query.file;

  $: selectedFileContent = selectedFilePath && files[selectedFilePath];
  $: selectedFileExt = selectedFileContent && getFileExt(selectedFilePath);

  function getFileExt(fileName = '') {
    return (fileName.match(/\.(.+)$/) || [])[1];
  }

  //
  // File saving
  //

  let selectedEditor;

  saveCurrentPlayground = function savePlayground() {
    if (!selectedEditor || !selectedFilePath) return;
    files[selectedFilePath] = selectedEditor.getEditedSource();
    console.log(' TODO save to localStorage', files);
  };

  //
  // File explorer
  //

  $: fileNames = Object.keys(files);

  let expandedFolders = selectedFilePath ? [selectedFilePath] : [];

  function handleFileClick(e) {
    action('Playground.save')();

    const { file, folder } = e.detail;
    if (file) {
      selectedFilePath = file;
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
  // Url update
  //

  $: {
    let url = window.location.pathname;
    let andChar = '?';
    if (selectedProjectName) {
      url += andChar + 'project=' + selectedProjectName;
      andChar = '&';
    }
    if (selectedFilePath) {
      url += andChar + 'file=' + selectedFilePath;
    }
    history.replace(url);
  }

  //
  // Download project
  //

  let currentDownload;

  function download(files) {
    action('Playground.save')();

    const zip = new jszip();
    // TODO use folder for all with project name
    const dependencies = new Set();
    for (const [fileName, fileContent] of Object.entries(files)) {
      zip.file(fileName, fileContent);
      const ext = getFileExt(fileName);
      if (ext === 'proma') {
        const chip = proma.fromJSON(proma.chip, fileContent);
        const classSource = chip.compile();
        let source = '';
        // TODO should use some kind of chip.target or similar
        const isWeb = fileName.startsWith('www/');
        if (isWeb) {
          for (const [impVar, impName] of Object.entries(chip.imports)) {
            source += `import ${impVar} from 'https://esm.sh/${impName}';\n`;
            dependencies.add(impName);
          }
          source += `export default ${classSource}`;
        } else {
          for (const [impVar, impName] of Object.entries(chip.imports)) {
            source += `const ${impVar} = require('${impName}');\n`;
            dependencies.add(impName);
          }
          source += `module.exports = ${classSource}`;
        }
        zip.file(
          fileName.substr(0, fileName.length - ext.length) + 'js',
          source,
        );
      }
    }

    const pkg = {
      name: 'proma-project',
      version: '1.0.0',
      description: 'Proma preview project',
      main: 'index.js',
      scripts: {
        start: 'node index.js',
      },
      license: 'MIT',
      dependencies: {
        express: '4.17.1',
      },
    };
    for (const dep of dependencies) {
      pkg.dependencies[dep] = '*';
    }
    zip.file('package.json', JSON.stringify(pkg, null, 2));

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
  <div class="Sidebar">
    <div class="PreviewTitle">
      <div class="spacer" />
      <h1>Proma <span class="sub">Concept</span></h1>
    </div>
    <div class="FileExplorer">
      <FileTree
        files={fileNames}
        expand={expandedFolders}
        select={selectedFilePath}
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
  <div class="Editor">
    {#if selectedFileExt === 'proma'}
      <PromaFileEditor
        bind:this={selectedEditor}
        source={selectedFileContent}
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
    {:else if selectedFileExt}
      <CodeMirror
        bind:this={selectedEditor}
        options={{
          value: selectedFileContent,
          mode: selectedFileExt,
        }}
      />
    {:else}
      <div>Select a file</div>
    {/if}
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

  .Sidebar {
    flex: 0 0 256px;

    width: 256px;
    display: flex;
    flex-direction: column;
    align-items: center;

    background-color: var(--proma-panel--background-color, #fbfdfe);
    box-shadow: 1px 0 3px var(--proma-panel--shadow-color, #eaedf0);
    z-index: 1;
  }

  .Editor {
    flex-grow: 1;
  }

  /* Sidebar contents */

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
    overflow: hidden;

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
