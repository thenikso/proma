<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { Check, ChevronsUpDown, Plus, Trash2 } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card } from '$lib/components/ui/card';
	import { ScrollArea } from '$lib/components/ui/scroll-area';

	let {
		placeholder = 'Select...',
		items = [],
		value = undefined,
		getOptionLabel = (option) => option?.label,
		createItem = undefined,
	} = $props();

	const dispatch = createEventDispatcher();

	let query = $state('');
	let open = $state(false);
	let containerEl = $state();
	let menuEl = $state();
	let highlightedIndex = $state(0);

	function displayLabel(option) {
		return option ? getOptionLabel(option) : '';
	}

	function selectItem(item) {
		dispatch('select', item);
		query = '';
		open = false;
	}

	function clearItem() {
		dispatch('clear');
		query = '';
		open = false;
	}

	function normalize(value) {
		return String(value ?? '').toLowerCase();
	}

	let filteredItems = $derived.by(() => {
		const base = items.filter((item) => normalize(getOptionLabel(item)).includes(normalize(query)));
		if (!query || !createItem) return base;
		const exact = items.some((item) => normalize(getOptionLabel(item)) === normalize(query));
		if (exact) return base;
		return [{ ...createItem(query), isCreator: true }, ...base];
	});

	function handleKeydown(event) {
		if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
			open = true;
			return;
		}
		if (!open) return;
		if (event.key === 'Escape') {
			open = false;
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlightedIndex = Math.min(highlightedIndex + 1, Math.max(filteredItems.length - 1, 0));
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
			return;
		}
		if (event.key === 'Enter' && filteredItems[highlightedIndex]) {
			event.preventDefault();
			selectItem(filteredItems[highlightedIndex]);
		}
	}

	function handleDocumentClick(event) {
		if (!containerEl) return;
		if (containerEl.contains(event.target)) return;
		open = false;
	}

	onMount(() => {
		document.addEventListener('mousedown', handleDocumentClick);
		return () => document.removeEventListener('mousedown', handleDocumentClick);
	});

	$effect(() => {
		highlightedIndex = 0;
	});
</script>

<div class="relative" bind:this={containerEl}>
	<div class="flex items-center gap-2">
		<div class="relative flex-1">
			<Input
				type="text"
				class="pr-8"
				bind:value={query}
				placeholder={value ? displayLabel(value) : placeholder}
				onfocus={() => (open = true)}
				oninput={() => (open = true)}
				onkeydown={handleKeydown}
			/>
			<ChevronsUpDown class="text-muted-foreground pointer-events-none absolute top-2.5 right-2 h-4 w-4" />
		</div>
		<Button
			class=""
			variant="outline"
			size="icon"
			type="button"
			title="Delete current project"
			disabled={!value}
			onclick={clearItem}
		>
			<Trash2 class="h-4 w-4" />
		</Button>
	</div>

	{#if open}
		<Card
			bind:this={menuEl}
			class="absolute z-20 mt-2 w-full border shadow-lg"
			role="listbox"
			tabindex="-1"
		>
			<ScrollArea class="max-h-64 p-1">
				{#if filteredItems.length === 0}
					<div class="text-muted-foreground px-3 py-2 text-sm">No projects found</div>
				{:else}
					{#each filteredItems as item, index}
						<button
							type="button"
							class={cn(
								'flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm',
								index === highlightedIndex && 'bg-accent text-accent-foreground',
							)}
							role="option"
							aria-selected={value?.value === item.value}
							onmouseenter={() => (highlightedIndex = index)}
							onclick={() => selectItem(item)}
						>
							<span class="flex items-center gap-2">
								{#if item.isCreator}
									<Plus class="h-4 w-4" />
								{/if}
								{displayLabel(item)}
							</span>
							{#if value?.value === item.value}
								<Check class="h-4 w-4" />
							{/if}
						</button>
					{/each}
				{/if}
			</ScrollArea>
		</Card>
	{/if}
</div>
