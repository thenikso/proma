<script>
	import { PortOutlet } from '@proma/svelte-components';
	import { edit as promaEdit } from '@proma/core';
	import { Input } from '$lib/components/ui/input';

	let { chip } = $props();

	let edit = $derived(chip && promaEdit(chip));
	let inputOutlets = $derived(chip.inputOutlets);
	let outputOutlets = $derived(chip.outputOutlets);
</script>

<div class="text-sm font-medium">Inputs</div>
{#each inputOutlets as outlet}
	<div class="port">
		<Input
			type="text"
			class=""
			placeholder="Port name"
			value={outlet.name}
			oninput={(e) => edit.renameOutlet(outlet, e.currentTarget.value)}
		/>
		<PortOutlet type={outlet.isFlow ? 'exec' : outlet.type.definitionKind} />
		{#if outlet.isData}
			<Input type="text" class="" placeholder="type" value={outlet.type.signatureWithLabels} readonly />
		{/if}
	</div>
{/each}

<div class="mt-3 text-sm font-medium">Outputs</div>
{#each outputOutlets as outlet}
	<div class="text-muted-foreground text-sm">{outlet.name}</div>
{/each}

<style>
	.port {
		display: grid;
		grid-template-columns: 2fr auto 1fr;
		grid-template-rows: 1fr;
		gap: 10px;
		align-items: center;
		margin: 8px 0;
	}
</style>
