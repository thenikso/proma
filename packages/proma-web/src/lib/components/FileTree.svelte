<script>
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FileIcon from '@lucide/svelte/icons/file-text';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FileTree from './FileTree.svelte';
	import { createEventDispatcher } from 'svelte';
	import { cn } from '$lib/utils';

	let { root = undefined, files = [], expand = [], selected = undefined, depth = 0 } = $props();

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

	let treeData = $derived.by(() => {
		/** @type {Map<string, string[]>} */
		const folders = new Map();
		/** @type {string[]} */
		const leafFiles = [];
		const ordered = [...safeFiles].sort((a, b) => a.localeCompare(b));
		for (const fullPath of ordered) {
			const [first, ...rest] = fullPath.split('/');
			if (!first) continue;
			if (rest.length === 0) {
				leafFiles.push(first);
				continue;
			}
			const current = folders.get(first) ?? [];
			current.push(rest.join('/'));
			folders.set(first, current);
		}
		return {
			folderNames: [...folders.keys()].sort((a, b) => a.localeCompare(b)),
			folders,
			leafFiles,
		};
	});

	let folderItems = $derived(
		treeData.folderNames.map((name) => {
			const childFiles = treeData.folders.get(name) ?? [];
			const childExpand = safeExpand
				.filter((entry) => entry && entry.startsWith(name + '/'))
				.map((entry) => entry.slice(name.length + 1));
			if (safeExpand.some((entry) => entry && (entry === name || entry.startsWith(name + '/')))) {
				childExpand.unshift('.');
			}
			const childSelected =
				selected && selected.startsWith(name + '/') ? selected.slice(name.length + 1) : undefined;
			return {
				name,
				files: childFiles,
				expand: childExpand,
				selected: childSelected,
			};
		}),
	);

	let showFolderFiles = $derived(safeExpand.length > 0 || !root);
	let rowPadding = $derived(`${depth * 14 + 6}px`);
	let filePadding = $derived(`${(root ? depth + 1 : depth) * 14 + 6}px`);

	function handleChildSelect(e, parentFolder) {
		const { file, folder } = e.detail;
		if (file) {
			dispatchSelectFile(`${parentFolder}/${file}`);
			return;
		}
		if (folder === '.') {
			dispatchSelectFolder(parentFolder);
			return;
		}
		dispatchSelectFolder(folder ? `${parentFolder}/${folder}` : parentFolder);
	}
</script>

<div class="space-y-0.5">
	{#if root}
		<button
			type="button"
			class={cn(
				'flex w-full items-center gap-2 rounded-sm py-1 pr-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
				showFolderFiles && 'bg-muted/60',
			)}
			style={`padding-left: ${rowPadding};`}
			onclick={() => dispatchSelectFolder('.')}
		>
			<ChevronRight
				class={cn('h-4 w-4 shrink-0 transition-transform', showFolderFiles && 'rotate-90')}
			/>
			<FolderIcon class="h-4 w-4 shrink-0" />
			<span class="truncate">{root}</span>
		</button>
	{/if}

	{#if showFolderFiles}
		{#each folderItems as item (item.name)}
			<FileTree
				root={item.name}
				files={item.files}
				expand={item.expand}
				selected={item.selected}
				depth={root ? depth + 1 : depth}
				on:select={(e) => handleChildSelect(e, item.name)}
			/>
		{/each}

		{#each treeData.leafFiles as file (file)}
			<button
				type="button"
				class={cn(
					'flex w-full items-center gap-2 rounded-sm py-1 pr-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
					selected === file && 'bg-accent text-accent-foreground',
				)}
				style={`padding-left: ${filePadding};`}
				onclick={() => dispatchSelectFile(file)}
			>
				<FileIcon class="h-4 w-4 shrink-0" />
				<span class="truncate">{file}</span>
			</button>
		{/each}
	{/if}
</div>
