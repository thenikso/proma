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
	<div class="my-2 grid grid-cols-[2fr_auto_1fr] items-center gap-2">
		<Input
			type="text"
			class=""
			placeholder="Port name"
			value={outlet.name}
			oninput={(e) => edit.renameOutlet(outlet, e.currentTarget.value)}
		/>
		<PortOutlet type={outlet.isFlow ? 'exec' : outlet.type.definitionKind} />
		{#if outlet.isData}
			<Input
				type="text"
				class=""
				placeholder="type"
				value={outlet.type.signatureWithLabels}
				readonly
			/>
		{/if}
	</div>
{/each}

<div class="mt-3 text-sm font-medium">Outputs</div>
{#each outputOutlets as outlet}
	<div class="text-sm text-muted-foreground">{outlet.name}</div>
{/each}
