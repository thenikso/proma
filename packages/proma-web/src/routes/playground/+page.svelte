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
  import { CodeMirror } from '@proma/svelte-components';
  import jszip from 'jszip';
  import { saveAs } from 'file-saver';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import FileTree from '$lib/components/FileTree.svelte';
  import PromaFileEditor from '$lib/PromaFileEditor.svelte';
  import PromaRunEditor from '$lib/PromaRunEditor.svelte';
  import PromaBoardDetails from '$lib/PromaBoardDetails.svelte';
  import makeBaseProject from '$lib/playground-projects/base';
  import Select from 'svelte-select';

  //
  // Project Selection
  //

  $: selectedProjectName = $page.url.searchParams.get('project');
  $: selectedProjectDataString =
    selectedProjectName &&
    localStorage.getItem('project-' + selectedProjectName);

  //
  // Project Load
  //

  let files;
  $: if (selectedProjectDataString) {
    files = JSON.parse(selectedProjectDataString);
  } else {
    files = makeBaseProject();
  }

  //
  // Projects List
  //

  let projectsOptions = [];

  function updateProjectsOptions() {
    const options = Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.key(i),
    )
      .filter((k) => k.startsWith('project-'))
      .map((k) => k.substr(8))
      .map((label) => ({
        label,
        value: 'project-' + label,
      }));
    const allOptions = [
      {
        label: '➕ &nbsp;New Project',
        value: 'new',
      },
      ...options,
    ];
    projectsOptions = allOptions;
    return allOptions;
  }

  updateProjectsOptions();

  $: selectedProjectOption = selectedProjectName && {
    label: selectedProjectName,
    value: 'project-' + selectedProjectName,
  };

  function handleProjectOptionSelect({ detail }) {
    if (detail.label === selectedProjectName) return;

    action('Playground.save')();

    if (detail.value === 'new') {
      updateUrl({ project: null, file: 'readme.md' });
    } else {
      const shouldSaveAs = detail.value.startsWith('saveas-');
      const nextProjectName = detail.label;
      if (shouldSaveAs) {
        updateUrl({ project: nextProjectName });
        action('Playground.save')();
        updateProjectsOptions();
      } else {
        updateUrl({ project: nextProjectName, file: null });
      }
    }
  }

  function handleProjectOptionClear() {
    if (selectedProjectName) {
      localStorage.removeItem('project-' + selectedProjectName);
      updateProjectsOptions();
    }

    updateUrl({ project: null, file: 'readme.md' });
  }

  const projectSelectOptionLabel = (option) =>
    option.isCreator ? `Save as "${option.label}"` : option.label;

  const projectSelectCreateItem = (text) => ({
    value: 'saveas-' + text,
    label: text,
  });

  $: projectSelectPlaceholder =
    projectsOptions.length < 2 ? 'Save as...' : 'Select project or save as...';

  //
  // File Selection
  //

  $: selectedFilePath = $page.url.searchParams.get('file');

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
    if (!selectedEditor || !selectedFilePath || !selectedProjectName) return;
    try {
      files[selectedFilePath] = selectedEditor.getEditedSource();
      localStorage.setItem(
        'project-' + selectedProjectName,
        JSON.stringify(files),
      );
    } catch (e) {
      console.error('Could not save', e);
    }
  };

  //
  // File explorer
  //

  $: fileNames = Object.keys(files);

  $: expandedFolders = selectedFilePath ? [selectedFilePath] : [];

  function handleFileSelect(e) {
    const { file, folder } = e.detail;
    if (file) {
      action('Playground.save')();
      updateUrl({ file });
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
  // Tool selection
  //

  let promaChipInstance;

  const VALID_TOOLS = {
    proma: ['info', 'test'],
  };

  $: selectedTool = (VALID_TOOLS[selectedFileExt] || []).includes(
    ($page.url.hash || '').replace(/^#/, ''),
  )
    ? ($page.url.hash || '').replace(/^#/, '')
    : '';

  async function updateUrl({
    project = selectedProjectName,
    file = selectedFilePath,
    fragment = selectedTool,
  } = {}) {
    const params = new URLSearchParams();
    if (project) params.set('project', project);
    if (file) params.set('file', file);
    const query = params.toString();
    const hash = fragment ? `#${fragment}` : '';
    const next = `${$page.url.pathname}${query ? `?${query}` : ''}${hash}`;
    const current = `${$page.url.pathname}${$page.url.search}${$page.url.hash}`;
    if (next !== current) {
      await goto(next, { replaceState: true, noScroll: true, keepFocus: true });
    }
  }

  //
  // Download project
  //

  let currentDownload;

  async function download(files) {
    action('Playground.save')();

    const zip = new jszip();
    // TODO use folder for all with project name
    const dependencies = new Set();
    for (const [fileName, fileContent] of Object.entries(files)) {
      zip.file(fileName, fileContent);
      const ext = getFileExt(fileName);
      if (ext === 'proma') {
        const chip = await proma.fromJSON(proma.chip, fileContent);
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
      <h1>Proma <span class="sub">Experiment</span></h1>
    </div>
    <div class="ProjectsExplorer">
      <Select
        placeholder={projectSelectPlaceholder}
        items={projectsOptions}
        value={selectedProjectOption}
        isCreatable
        getOptionLabel={projectSelectOptionLabel}
        createItem={projectSelectCreateItem}
        on:select={handleProjectOptionSelect}
        on:clear={handleProjectOptionClear}
      />
    </div>
    <div class="FileExplorer">
      <FileTree
        files={fileNames}
        expand={expandedFolders}
        selected={selectedFilePath}
        on:select={handleFileSelect}
      />
    </div>
    <div class="ProjectTools">
      <button
        type="button"
        class="button"
        on:click={handleDownloadClick}
        disabled={!!currentDownload}
      >
        Build &amp; Download
      </button>
      <button type="button" class="button primary">Take survey</button>
    </div>
  </div>
  <div class="Editor">
    {#if selectedFileExt === 'proma'}
      <PromaFileEditor
        bind:this={selectedEditor}
        source={selectedFileContent}
        instance={promaChipInstance}
        let:chip
        let:selectedChips
      >
        {#if selectedTool}
          <div class="ToolsPanel">
            <div class="ToolsTabs">
              <button
                type="button"
                on:click={() => updateUrl({ fragment: 'info' })}
              >
                info
              </button>
              <button
                type="button"
                on:click={() => updateUrl({ fragment: 'test' })}
              >
                test
              </button>
            </div>
            <div class="ToolsBody">
              {#if selectedTool === 'info'}
                {#if selectedChips.length > 0}
                  <div>TODO sub-chip info here</div>
                {:else}
                  <PromaBoardDetails {chip} />
                {/if}
              {:else if selectedTool === 'test'}
                <PromaRunEditor
                  {chip}
                  bind:instance={promaChipInstance}
                  on:testChange={(e) => {
                    chip.metadata = {
                      ...chip.metadata,
                      tests: [e.detail.test],
                    };
                  }}
                />
              {/if}
            </div>
          </div>
        {/if}
        <button
          type="button"
          class="RunButton button primary"
          on:click={() => updateUrl({ fragment: 'test' })}>Test</button
        >
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
      <div>No File Selected</div>
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
    font-size: 16px;
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

  .ProjectsExplorer {
    width: 100%;
    padding: 0px 8px 8px 8px;
  }

  .FileExplorer {
    flex-grow: 1;
    overflow: auto;

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

  /* Editor Proma */

  .RunButton {
    position: absolute;
    right: 20px;
    top: 20px;
    margin: 0;
    min-width: 140px;
  }

  .ToolsPanel {
    box-sizing: border-box;

    display: flex;
    flex-direction: column;

    position: absolute;
    right: 20px;
    top: 80px;
    width: 350px;
    height: 100%;
    max-height: calc(100% - 100px);

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

  .ToolsBody {
    flex-grow: 1;
    padding: 8px;
    overflow: auto;
  }
</style>
