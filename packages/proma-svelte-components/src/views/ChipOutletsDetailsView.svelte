<script>
	import { onDestroy } from 'svelte';
	import { StringInput } from '../inputs';

	let { chip, edit } = $props();

	//
	// Init chip editing
	//

	let stableChip;
	let inputOutlets = $state();
	let outputOutlets = $state();

	let oldEdit;

	onDestroy(() => {
		if (oldEdit) {
			editDestroy(oldEdit);
		}
	});

	function editMount(edit) {
		edit.on('outlet', editOnOutlet);
	}

	function editDestroy(edit) {
		edit.off('outlet', editOnOutlet);
	}

	function editOnOutlet() {
		inputOutlets = stableChip.inputOutlets;
		outputOutlets = stableChip.outputOutlets;
	}
	$effect(() => {
		if (stableChip !== chip) {
			stableChip = chip;
			inputOutlets = stableChip.inputOutlets;
			outputOutlets = stableChip.outputOutlets;
		}
	});
	$effect(() => {
		if (edit !== oldEdit) {
			if (oldEdit) {
				editDestroy(oldEdit);
			}
			oldEdit = edit;
			editMount(edit);
		}
	});
</script>

<section>
	<header>Inputs</header>
	{#each inputOutlets as outlet}
		<div>
			<StringInput
				value={outlet.name}
				placeholder="Port name"
				validate={(name) => edit.renameOutlet(outlet, name, true)}
				on:input={(event) => edit.renameOutlet(outlet, event.detail.value)}
			/>
		</div>
	{/each}
</section>

<section>
	<header>Outputs</header>
	{#each outputOutlets as outlet}
		<div>
			<StringInput value={outlet.name} placeholder="Port name" />
		</div>
	{/each}
</section>
