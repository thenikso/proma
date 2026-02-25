<script>
	import GroupList from './GroupList.svelte';

	// An array of objects that will be sent to a slot
	// - groups are objects with `{ groupStart: 'group id', noCollapse: false }`
	//   and will be sent to slot named "groupStart"
	// - groups can be ended (or they will extend till the next group or end
	//   of list) with a `{ groupEnd: 'group id' }` and will be sent to slot "groupEnd"
	// - other items will be sent to slot "item"
	// - if an item is an array it is treated as a nested GroupList
	let { items = [], getItemOptions, groupStart, groupEnd, item: itemSnippet } = $props();

	const ROOT_GROUP = {
		get collapsed() {
			return false;
		},
	};

	const itemsStatus = $derived(
		items.reduce(
			(temp, item) => {
				const options = getItemOptions?.(item) ?? item;
				if (options.groupStart) {
					const group = (temp.currentGroup = {
						id: options.groupStart,
						collapsed: !options.noCollapse,
						open() {
							group.collapsed = false;
						},
						close() {
							group.collapsed = true;
						},
						toggle() {
							group.collapsed = !group.collapsed;
						},
					});
				}
				temp.result.push({ options, item, group: temp.currentGroup });
				if (options.groupEnd) {
					temp.currentGroup = ROOT_GROUP;
				}
				return temp;
			},
			{ result: [], currentGroup: ROOT_GROUP },
		).result,
	);
</script>

{#each itemsStatus as { item, options, group }}
	{#if options.groupStart}
		{#if groupStart}
			{@render groupStart({
				item,
				options,
				toggle: () => (group.collapsed = !group.collapsed),
				collapsed: group.collapsed,
			})}
		{:else}
			<div
				onclick={() => (group.collapsed = !group.collapsed)}
				style="background: white; position: sticky; top: 0;"
			>
				<strong>{options.text}</strong>
			</div>
		{/if}
	{:else if !group.collapsed}
		{#if options.groupEnd}
			{@render groupEnd?.({ item, options })}
		{:else if Array.isArray(options)}
			<GroupList {groupStart} {groupEnd} item={itemSnippet} items={options} {getItemOptions} />
		{:else if itemSnippet}
			{@render itemSnippet({ item, options })}
		{:else}
			<div>{options.text}</div>
		{/if}
	{/if}
{/each}
