<script module>
	import { action } from '@proma/svelte-components';

	let saveCurrentPlayground;

	action.provide('Playground.save', () => {
		if (!saveCurrentPlayground) return;
		saveCurrentPlayground();
	});
</script>

<script>
	import * as proma from '@proma/core';
	import CodeMirror from '$lib/components/CodeMirror.svelte';
	import jszip from 'jszip';
	import { saveAs } from 'file-saver';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import FileTree from '$lib/components/FileTree.svelte';
	import ProjectCombobox from '$lib/components/ProjectCombobox.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import PromaFileEditor from '$lib/PromaFileEditor.svelte';
	import PromaRunEditor from '$lib/PromaRunEditor.svelte';
	import PromaBoardDetails from '$lib/PromaBoardDetails.svelte';
	import makeBaseProject from '$lib/playground-projects/base';
	import {
		buildProjectsOptions,
		projectSelectOptionLabel,
		projectSelectCreateItem,
	} from '$lib/project-options';

	//
	// Project Load
	//

	let files = $state({});

	//
	// Projects List
	//

	let projectsOptions = $state([]);

	function updateProjectsOptions() {
		const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
		const allOptions = buildProjectsOptions(keys);
		projectsOptions = allOptions;
		return projectsOptions;
	}

	updateProjectsOptions();

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

	function getFileExt(fileName = '') {
		return (fileName.match(/\.(.+)$/) || [])[1];
	}

	//
	// File saving
	//

	let selectedEditor = $state();

	saveCurrentPlayground = function savePlayground() {
		if (!selectedEditor || !selectedFilePath || !selectedProjectName) return;
		try {
			files[selectedFilePath] = selectedEditor.getEditedSource();
			localStorage.setItem('project-' + selectedProjectName, JSON.stringify(files));
		} catch (e) {
			console.error('Could not save', e);
		}
	};

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

	let promaChipInstance = $state();

	const VALID_TOOLS = {
		proma: ['info', 'test'],
	};

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

	let currentDownload = $state();

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
				zip.file(fileName.substr(0, fileName.length - ext.length) + 'js', source);
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
	//
	// Project Selection
	//

	let selectedProjectName = $derived($page.url.searchParams.get('project'));
	let selectedProjectDataString = $derived(
		selectedProjectName && localStorage.getItem('project-' + selectedProjectName),
	);
	$effect(() => {
		if (selectedProjectDataString) {
			files = JSON.parse(selectedProjectDataString);
		} else {
			files = makeBaseProject();
		}
	});
	let selectedProjectOption = $derived(
		selectedProjectName && {
			label: selectedProjectName,
			value: 'project-' + selectedProjectName,
		},
	);
	let projectSelectPlaceholder = $derived(
		projectsOptions.length < 2 ? 'Save as...' : 'Select project or save as...',
	);
	//
	// File Selection
	//

	let selectedFilePath = $derived($page.url.searchParams.get('file'));
	let selectedFileContent = $derived(selectedFilePath && files?.[selectedFilePath]);
	let selectedFileExt = $derived(selectedFileContent && getFileExt(selectedFilePath));
	//
	// File explorer
	//

	let fileNames = $derived(Object.keys(files ?? {}));
	let expandedFolders = $derived(selectedFilePath ? [selectedFilePath] : []);
	let selectedTool = $derived(
		(VALID_TOOLS[selectedFileExt] || []).includes(($page.url.hash || '').replace(/^#/, ''))
			? ($page.url.hash || '').replace(/^#/, '')
			: '',
	);
</script>

<main class="bg-background text-foreground flex h-screen w-screen">
	<aside class="bg-card flex w-80 shrink-0 flex-col border-r">
		<div class="flex h-16 items-center justify-between px-4">
			<div class="flex items-center gap-2">
				<img src="/images/logo.webp" alt="Proma" class="h-10 w-10 rounded-md" />
				<h1 class="text-lg font-semibold">
					Proma <span class="text-muted-foreground font-normal">Experiment</span>
				</h1>
			</div>
			<ThemeToggle />
		</div>
		<div class="px-4 pb-3">
			<ProjectCombobox
				placeholder={projectSelectPlaceholder}
				items={projectsOptions}
				value={selectedProjectOption}
				getOptionLabel={projectSelectOptionLabel}
				createItem={projectSelectCreateItem}
				on:select={handleProjectOptionSelect}
				on:clear={handleProjectOptionClear}
			/>
		</div>
		<div class="min-h-0 flex-1 px-4 pb-4">
			<Card class="flex h-full flex-col">
				<CardHeader class="pb-2">
					<CardTitle class="">Files</CardTitle>
				</CardHeader>
				<CardContent class="min-h-0 flex-1">
					<ScrollArea class="h-full rounded-md border">
						<FileTree
							files={fileNames}
							expand={expandedFolders}
							selected={selectedFilePath}
							on:select={handleFileSelect}
						/>
					</ScrollArea>
				</CardContent>
			</Card>
		</div>
		<div class="px-4 pb-4">
			<Button type="button" class="w-full" onclick={handleDownloadClick} disabled={!!currentDownload}>
				Build &amp; Download
			</Button>
		</div>
	</aside>
	<section class="relative min-w-0 flex-1">
		{#if selectedFileExt === 'proma'}
			<PromaFileEditor
				bind:this={selectedEditor}
				source={selectedFileContent}
				instance={promaChipInstance}
			>
				{#snippet children({ chip, selectedChips })}
					{#if selectedTool}
						<div
							class="bg-card text-card-foreground absolute top-20 right-5 flex h-[calc(100%-100px)] max-h-[calc(100%-100px)] w-[350px] flex-col rounded-lg border shadow-md"
						>
							<div class="border-b px-2 py-2">
								<Button
									class=""
									variant={selectedTool === 'info' ? 'secondary' : 'ghost'}
									size="sm"
									type="button"
									disabled={false}
									onclick={() => updateUrl({ fragment: 'info' })}
								>
									info
								</Button>
								<Button
									class=""
									variant={selectedTool === 'test' ? 'secondary' : 'ghost'}
									size="sm"
									type="button"
									disabled={false}
									onclick={() => updateUrl({ fragment: 'test' })}
								>
									test
								</Button>
							</div>
							<div class="flex-1 overflow-auto p-2">
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
					<Button
						type="button"
						class="absolute top-5 right-5 min-w-[140px]"
						disabled={false}
						onclick={() => updateUrl({ fragment: 'test' })}
					>
						Test
					</Button>
				{/snippet}
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
			<div class="text-muted-foreground grid h-full place-items-center text-sm">No File Selected</div>
		{/if}
	</section>
</main>
