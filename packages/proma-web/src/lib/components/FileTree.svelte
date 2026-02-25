<script>
	import FileTree from './FileTree.svelte';
	import { createEventDispatcher } from 'svelte';

	let { root = undefined, files = [], expand = [], selected = undefined } = $props();
	let safeFiles = $derived(Array.isArray(files) ? files : []);
	let safeExpand = $derived(Array.isArray(expand) ? expand : []);

	const dispatch = createEventDispatcher();

	function dispatchSelectFile(file) {
		if (file === selected) return;
		dispatch('select', { file });
	}

	function dispatchSelectFolder(folder) {
		dispatch('select', { folder });
	}

	let filePaths = $derived(
		safeFiles
			.sort((a, b) => {
				const aFolder = a.indexOf('/') >= 0;
				const bFolder = b.indexOf('/') >= 0;
				if (aFolder !== bFolder) return bFolder - aFolder;
				a = a.toLowerCase();
				b = b.toLowerCase();
				if (a > b) return 1;
				if (a < b) return -1;
				return 0;
			})
			.map((f) => f.split('/')),
	);

	let items = $derived(
		filePaths.reduce((acc, path) => {
			const firstPath = path[0];
			if (path.length === 1) {
				acc.push(firstPath);
			} else {
				const folder = acc[acc.length - 1];
				if (!folder || folder.folder !== firstPath) {
					const expandFolder = safeExpand
						.filter((s) => s && s.startsWith(firstPath + '/'))
						.map((s) => s.substr(firstPath.length + 1));
					if (safeExpand.some((s) => s && s.startsWith(firstPath))) {
						expandFolder.unshift('.');
					}
					acc.push({
						folder: firstPath,
						files: filePaths.filter((p) => p[0] === firstPath).map((p) => p.slice(1).join('/')),
						expand: expandFolder,
						selected:
							selected &&
							selected.startsWith(firstPath + '/') &&
							selected.substr(firstPath.length + 1),
					});
				}
			}
			return acc;
		}, []),
	);

	let showFolderFiles = $derived(safeExpand.length || !root);

	function handleChildSelect(e, parentItem) {
		const { file, folder } = e.detail;
		if (file) {
			dispatchSelectFile(parentItem.folder + '/' + file);
		} else if (root) {
			dispatchSelectFolder(root + '/' + folder);
		} else {
			dispatchSelectFolder(folder);
		}
	}
</script>

{#if root}
	<button type="button" class="item-name" onclick={() => dispatchSelectFolder(root)}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			{#if showFolderFiles}
				<path d="M6 9l6 6 6-6" />
			{:else}
				<path d="M9 18l6-6-6-6" />
			{/if}
		</svg>

		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
		</svg>
		{root}
	</button>
{/if}
{#if showFolderFiles}
	<ol>
		{#each items as item}
			{#if typeof item === 'string'}
				<li>
					<button
						type="button"
						class="item-name"
						class:selected={selected === item}
						onclick={() => dispatchSelectFile(item)}
					>
						<div class="spacer"></div>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
							<path d="M14 3v5h5M16 13H8M16 17H8M10 9H8" />
						</svg>
						{item}
					</button>
				</li>
			{:else}
				<li>
					<FileTree
						root={item.folder}
						files={item.files}
						expand={item.expand}
						selected={item.selected}
						on:select={(e) => handleChildSelect(e, item)}
					/>
				</li>
			{/if}
		{/each}
	</ol>
{/if}

<style>
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.spacer {
		display: inline-block;
		width: 18px;
	}

	li > :global(ol > .item-name),
	li > :global(ol > li > .item-name) {
		padding-left: 16px;
	}

	li > :global(ol > li > ol > .item-name),
	li > :global(ol > li > ol > li > .item-name) {
		padding-left: 32px;
	}

	li > :global(ol > li > ol > li > ol > .item-name),
	li > :global(ol > li > ol > li > ol > li > .item-name) {
		padding-left: 48px;
	}

	.item-name {
		display: block;
		width: 100%;
		border: none;
		background: transparent;
		text-align: left;
		font-size: inherit;
		font-family: inherit;
		padding-top: 3px;
		padding-bottom: 3px;
		user-select: none;
		cursor: pointer;
		transition: background 0.25s ease;
	}

	.item-name.selected {
		background: #ecdff8;
	}

	.item-name:hover {
		background: #f1f1f1;
	}
</style>
