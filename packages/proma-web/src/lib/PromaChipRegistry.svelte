<script>
	import Fuse from 'fuse.js';
	import { onMount, tick } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import GroupList from '$lib/components/GroupList.svelte';
	import TextWithMatches from '$lib/components/TextWithMatches.svelte';
	const dispatch = createEventDispatcher();

	let { registry, contextChips = [] } = $props();

	function dispatchClose() {
		dispatch('close');
	}

	function dispatchSelect(chip) {
		dispatch('select', { chip });
	}

	//
	// Search box init
	//

	let searchInputEl = $state();
	let searchValue = $state();

	function focusSearchInput() {
		searchInputEl?.focus();
	}

	//
	// Build registry list
	//

	const registryGroupList = $derived(chipListToGroupListOptions(registry.chipList));

	//
	// Selection
	//

	let resultListEl = $state();
	let highlightedEl = $state();

	function highlightNext() {
		if (!resultListEl) return;
		if (highlightedEl) {
			do {
				highlightedEl = highlightedEl.nextElementSibling;
			} while (highlightedEl && !highlightedEl.id);
		}
		if (!highlightedEl && resultListEl.children.length > 0) {
			highlightedEl = resultListEl.children[0];
			if (!highlightedEl.id) {
				highlightNext();
			}
		}
	}

	function highlightPrev() {
		if (!resultListEl) return;
		if (highlightedEl) {
			do {
				highlightedEl = highlightedEl.previousElementSibling;
			} while (highlightedEl && !highlightedEl.id);
		}
		if (!highlightedEl) {
			highlightedEl = resultListEl.children[resultListEl.children.length - 1];
		}
	}

	//
	// Event handlers
	//

	function handleClearClick() {
		searchValue = '';
		searchInputEl.focus();
	}

	function handleKeyDown(e) {
		let stopEvent = true;
		switch (e.key) {
			case 'Enter':
			case 'Tab':
				if (highlightedEl) {
					highlightedEl.click();
				}
				break;
			case 'Escape':
				if (searchValue) {
					searchValue = '';
				} else {
					dispatchClose();
				}
				break;
			case 'ArrowDown':
				highlightNext();
				break;
			case 'ArrowUp':
				highlightPrev();
				break;
			default:
				stopEvent = false;
				break;
		}
		if (stopEvent) {
			e.stopPropagation();
			e.preventDefault();
		}
	}

	//
	// Utils
	//

	const wordsRegExp = /[A-Z][^A-Z\d]+|\d+|[A-Z]+(?![a-z])/g;

	function camelCaseToTitle(str) {
		str = str[0].toUpperCase() + str.slice(1);
		const words = [];
		let wordMatch;
		while ((wordMatch = wordsRegExp.exec(str))) {
			words.push(wordMatch[0].replace(/_/g, '').trim());
		}
		return words.filter((x) => !!x).join(' ');
	}

	function sortedKeys(obj) {
		return Array.from(Object.keys(obj))
			.sort((a, b) => {
				if (a < b) return -1;
				if (a > b) return 1;
				return 0;
			})
			.filter((k) => !k.startsWith('$'));
	}

	function itemsFromEntry(entries, key) {
		const entry = entries[key];
		if (entry.$group === key) {
			return [
				{ groupStart: key, text: camelCaseToTitle(key) },
				...sortedKeys(entry).map((k) => itemsFromEntry(entry, k)),
			];
		}
		return { ...entry, text: key };
	}

	function makeChipEntry(chip) {
		const URI = chip.URI.split('/');
		const path = URI.slice(0, URI.length - 1);
		const name = URI[URI.length - 1];
		return {
			id: chip.URI,
			path,
			name,
			label: chip.label,
			description: chip.metadata?.description,
			chip,
		};
	}

	function chipListToURITree(chipList) {
		const res = {};
		for (const chip of chipList) {
			const entry = makeChipEntry(chip);
			let cursor = res;
			for (const part of entry.path) {
				if (!cursor[part]) {
					cursor[part] = {
						$group: part,
					};
				}
				cursor = cursor[part];
			}
			cursor[entry.name] = entry;
		}
		return res;
	}

	function chipListToGroupListOptions(chipList) {
		const registryMap = chipListToURITree(chipList);
		return sortedKeys(registryMap)
			.map((k) => itemsFromEntry(registryMap, k))
			.flat(1);
	}
	onMount(async () => {
		await tick();
		requestAnimationFrame(() => {
			focusSearchInput();
		});
	});
	//
	// Build context chip list
	//

	let contextGroupList = $derived(
		contextChips && contextChips.length && chipListToGroupListOptions(contextChips),
	);
	//
	// Build list for display
	//

	let fullGroupList = $derived(
		contextGroupList
			? [...contextGroupList, { header: 'From Libraries' }, ...registryGroupList]
			: registryGroupList,
	);
	let registryFuse = $derived(
		new Fuse(
			fullGroupList.flat().filter((i) => !i.groupStart && !i.header),
			{
				keys: ['text'],
				includeMatches: true,
			},
		),
	);
	let groupListOptions = $derived(
		searchValue
			? {
					items: registryFuse?.search(searchValue),
					getItemOptions: (x) => x.item,
				}
			: { items: fullGroupList },
	);
	$effect(() => {
		if (groupListOptions && resultListEl) {
			setTimeout(() => {
				highlightedEl = null;
				highlightNext();
			});
		}
	});
	$effect(() => {
		highlightedEl?.scrollIntoViewIfNeeded();
	});
</script>

<svelte:window onkeydowncapture={handleKeyDown} />

<div class="PromaChipRegistry">
	<div class="search-bar">
		<svg
			class="search-icon"
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="11" cy="11" r="6" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
		<input type="text" placeholder="Search" bind:this={searchInputEl} bind:value={searchValue} />
		{#if searchValue}
			<button
				type="button"
				class="search-clear-button"
				aria-label="Clear search"
				onclick={handleClearClick}
			>
				<svg
					class="clear-icon"
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="#aaaaaa"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		{/if}
	</div>
	{#if groupListOptions.items.length === 0}
		<div class="result-empty">Nothing found</div>
	{:else}
		<div class="result-list" bind:this={resultListEl}>
			<GroupList items={groupListOptions.items} getItemOptions={groupListOptions.getItemOptions}>
				{#snippet groupStart({ item, options, toggle, collapsed })}
					<button
						type="button"
						id={options.text}
						class="library-path"
						class:highlighted={highlightedEl && highlightedEl.id === options.text}
						onclick={toggle}
					>
						<span>{options.text}</span>
						<svg
							class="indicator"
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							style="transform: rotate({collapsed ? '0' : '180deg'})"
						>
							<path d="M6 9l6 6 6-6" />
						</svg>
					</button>
				{/snippet}
				{#snippet item({ item, options })}
					{#if item.header}
						<div class="library-header">{item.header}</div>
					{:else}
						<button
							type="button"
							id={options.id}
							class="library-item"
							class:highlighted={highlightedEl && highlightedEl.id === options.id}
							onclick={() => dispatchSelect(options.chip)}
						>
							<div class="library-item-bg">
								<div class="library-item-title">
									{#if item?.matches}
										<TextWithMatches text={options.text} matches={item.matches} matchesKey="text" />
									{:else}
										{options.text}
									{/if}
								</div>
							</div>
						</button>
					{/if}
				{/snippet}
			</GroupList>
		</div>
	{/if}
</div>

<style>
	.PromaChipRegistry {
		border-radius: 4px;
		background-color: var(--card);
		color: var(--card-foreground);
		border: 1px solid var(--border);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--foreground) 15%, transparent);
		min-width: 400px;
		font-size: 16px;
	}

	.PromaChipRegistry * {
		box-sizing: border-box;
	}

	.search-bar {
		position: relative;
		color: var(--muted-foreground);
		border-bottom: 1px solid var(--border);
	}

	.search-bar svg.search-icon {
		position: absolute;
		top: 3px;
		left: 2px;
		pointer-events: none;
	}

	.search-bar input {
		box-sizing: border-box;
		width: 100%;
		padding: 9px 30px 8px 30px;
		color: var(--foreground);

		font-size: 1em;
		font-weight: 500;
		border: none;
		background: transparent;
		outline: none;
	}

	.search-clear-button {
		box-sizing: border-box;
		position: absolute;
		top: 3px;
		right: 3px;
		height: 30px;
		padding: 5px;
		border: none;
		background: transparent;
		cursor: pointer;
		outline: none;
	}

	.result-empty {
		text-align: center;
		padding: 10px;
		color: var(--muted-foreground);
	}

	.result-list {
		position: relative;
		overflow-y: auto;
		max-height: 300px;
		border-radius: 4px;
	}

	.library-header {
		padding: 5px 10px;
		cursor: default;
		color: var(--muted-foreground);
	}

	.library-path {
		display: block;
		position: sticky;
		top: 0;
		border: none;
		background: var(--muted);
		color: var(--muted-foreground);
		text-align: left;
		font-size: 1em;
		font-family: inherit;
		padding: 10px;
		width: 100%;
		outline: none;
	}

	.library-path .indicator {
		position: absolute;
		right: 10px;
		top: 10px;
		cursor: pointer;
	}

	.library-path.highlighted .indicator {
		background: color-mix(in srgb, var(--accent) 55%, transparent);
		border-radius: 4px;
	}

	.library-item {
		display: block;
		border: none;
		background: none;
		width: 100%;
		outline: none;
		text-align: left;
		font-size: 1em;
		font-family: inherit;
		font-weight: 500;
		padding: 5px;
		cursor: pointer;
	}

	.library-item-bg {
		padding: 5px;
	}

	.library-item.highlighted .library-item-bg,
	.library-item:hover .library-item-bg {
		background: color-mix(in srgb, var(--accent) 55%, transparent);
		border-radius: 4px;
	}

	.library-item-title :global(em) {
		font-style: normal;
		color: var(--primary);
	}
</style>
