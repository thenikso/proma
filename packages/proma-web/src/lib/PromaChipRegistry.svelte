<script>
	import { onMount, tick } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import * as Command from '$lib/components/ui/command';

	const dispatch = createEventDispatcher();

	let { registry, contextChips = [] } = $props();

	let searchInputEl = $state();
	let searchValue = $state('');

	function dispatchClose() {
		dispatch('close');
	}

	function dispatchSelect(chip) {
		dispatch('select', { chip });
	}

	const wordsRegExp = /[A-Z][^A-Z\d]+|\d+|[A-Z]+(?![a-z])/g;

	function camelCaseToTitle(str) {
		if (!str) return '';
		wordsRegExp.lastIndex = 0;
		str = str[0].toUpperCase() + str.slice(1);
		const words = [];
		let wordMatch;
		while ((wordMatch = wordsRegExp.exec(str))) {
			words.push(wordMatch[0].replace(/_/g, '').trim());
		}
		return words.filter((x) => !!x).join(' ');
	}

	function makeItem(chip, source) {
		const uriParts = chip.URI.split('/');
		const path = uriParts.slice(0, uriParts.length - 1).join('/');
		const name = uriParts[uriParts.length - 1];
		const title = chip.label || camelCaseToTitle(name);
		return {
			id: chip.URI,
			chip,
			title,
			path,
			source,
			keywords: [chip.URI, title, name, path].filter(Boolean),
		};
	}

	let contextItems = $derived(contextChips.map((chip) => makeItem(chip, 'context')));
	let libraryItems = $derived(registry.chipList.map((chip) => makeItem(chip, 'library')));

	function handleWindowKeydown(event) {
		if (event.key !== 'Escape') return;
		if (searchValue) {
			searchValue = '';
		} else {
			dispatchClose();
		}
	}

	onMount(async () => {
		await tick();
		searchInputEl?.focus();
	});
</script>

<svelte:window onkeydowncapture={handleWindowKeydown} />

<div class="w-[440px] rounded-lg border bg-popover text-popover-foreground shadow-xl">
	<Command.Root class="" label="Chip registry" shouldFilter loop>
		<Command.Input
			class=""
			bind:ref={searchInputEl}
			bind:value={searchValue}
			placeholder="Search chips"
		/>
		<Command.List class="max-h-[360px]">
			<Command.Empty class="">Nothing found</Command.Empty>

			{#if contextItems.length > 0}
				<Command.Group heading="From Context" class="">
					{#each contextItems as item (item.id)}
						<Command.Item
							class="items-start py-2"
							value={item.id}
							keywords={item.keywords}
							onSelect={() => dispatchSelect(item.chip)}
						>
							<div class="flex min-w-0 flex-1 flex-col">
								<div class="truncate text-sm font-medium">{item.title}</div>
								<div class="text-muted-foreground truncate text-xs">{item.path || 'Current project'}</div>
							</div>
							<span
								class="bg-secondary text-secondary-foreground inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium"
								>context</span
							>
						</Command.Item>
					{/each}
				</Command.Group>
				<Command.Separator class="" />
			{/if}

			<Command.Group heading="From Libraries" class="">
				{#each libraryItems as item (item.id)}
					<Command.Item
						class="items-start py-2"
						value={item.id}
						keywords={item.keywords}
						onSelect={() => dispatchSelect(item.chip)}
					>
						<div class="flex min-w-0 flex-1 flex-col">
							<div class="truncate text-sm font-medium">{item.title}</div>
							<div class="text-muted-foreground truncate text-xs">{item.path || 'Library root'}</div>
						</div>
					</Command.Item>
				{/each}
			</Command.Group>
		</Command.List>
	</Command.Root>
</div>
