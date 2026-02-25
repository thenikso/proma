<script>
	import { action } from '@proma/svelte-components';
	import { page } from '$app/stores';
	import { fetchApi } from '$lib/api';
	import { keyMods } from '$lib/stores';
	import PromaFileEditor from '$lib/PromaFileEditor.svelte';

	// TODO this should probably be in a store
	let getCurrentProjectToSave = $derived(
		editor &&
			function projectToSave() {
				const selectedFileContent = btoa(editor.getEditedSource());
				project.files[selectedFilePath] = selectedFileContent;
				return project;
			},
	);
	let savingPromise;

	action.provide('CurrentProject.save', async () => {
		if (!getCurrentProjectToSave) return;
		const projectToSave = getCurrentProjectToSave();
		if (!projectToSave) return;
		savingPromise = await fetchApi(
			`/project/${projectToSave.ownerHostId}/${projectToSave.projectSlug}`,
			{
				method: 'post',
				body: projectToSave,
			},
		);
		return savingPromise;
	});

	let projectPromise = $state();
	let project = $state();
	let selectedFilePath = $state();
	let currentProjectKey = $state();

	function loadProject(hostId, projectSlug) {
		project = null;
		selectedFilePath = '';
		projectPromise = fetchApi(`/project/${hostId}/${projectSlug}`).then((res) => {
			project = res;
			selectedFilePath = $page.url.searchParams.get('file') ?? Object.keys(project?.files ?? {})[0];
			return res;
		});
	}

	// $: selectedFileRunUrl =
	//   project &&
	//   `${BACKEND_ENDPOINT}/run/${project.ownerHostId}/${project.projectSlug}/${selectedFileName}`;

	let editor = $state();

	const save = action('CurrentProject.save');
	let isSaving = $state();

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
			action('PromaFile.runLocalCompiled')({ target: editor });
		} else if (e.metaKey && e.shiftKey) {
			action('PromaFile.runLocal')({ target: editor });
		} else {
			action('PromaFile.runRemote')({ target: editor });
		}
	}
	let hostId = $derived($page.params.hostId);
	let projectSlug = $derived($page.params.projectSlug);
	$effect(() => {
		const nextKey = `${hostId || ''}/${projectSlug || ''}`;
		if (nextKey && nextKey !== currentProjectKey) {
			currentProjectKey = nextKey;
			loadProject(hostId, projectSlug);
		}
	});
	let selectedFileName = $derived((selectedFilePath || '').split(/(\\|\/)/g).pop());
	let selectedFileExt = $derived(((selectedFilePath || '').match(/\.(.+)$/) || [])[1]);
	let selectedFileSource = $derived(atob(project?.files?.[selectedFilePath] ?? ''));
	//
	// Saving
	//
</script>

{#await projectPromise}
	<div>Loading...</div>
{:then}
	<div class="Editor Editor-fileType-{selectedFileExt}">
		{#if selectedFileExt === 'proma'}
			<PromaFileEditor bind:this={editor} source={selectedFileSource} />
		{:else}
			<div>Unsupported file type "${selectedFileExt}"</div>
		{/if}

		<div class="EditorHeader">
			<div class="Breadcrumbs">
				<div class="current">{selectedFilePath}</div>
			</div>
			<div class="Spacer"></div>
			<div class="Tools">
				<!-- TODO switch by selectedFileExt -->
				<button type="button" class="Tools-Run" onclick={handleRun}>
					{#if $keyMods.metaKey && $keyMods.shiftKey && $keyMods.altKey}
						<span>Test</span> <small>compiled</small>
					{:else if $keyMods.metaKey && $keyMods.shiftKey}
						<span>Test</span>
					{:else}
						<span>Run</span>
					{/if}
				</button>

				<button type="button" class="Tools-Save" onclick={handleSaveClick} disabled={isSaving}>
					<img src="/images/save.svg" alt="save" />
				</button>
			</div>
		</div>
	</div>
{:catch error}
	<div>Error: {error.message}</div>
{/await}

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
</style>
