<script>
	import { onDestroy } from 'svelte';
	import { StringInput, PortValueInput } from '../inputs';

	let { chip, edit, subChipId = $bindable() } = $props();

	// Stable chip

	let stableChip;

	// Edit

	let oldEdit;

	onDestroy(() => {
		if (oldEdit) {
			editDestroy(oldEdit);
		}
	});

	function editMount(edit) {
		edit.on('connection', editOnConnection, true);
		edit.on('port:variadicCount', editOnPortVariadicCount, true);
	}

	function editDestroy(edit) {
		edit.off('connection', editOnConnection, true);
		edit.off('port:variadicCount', editOnPortVariadicCount, true);
	}

	function editOnConnection() {
		subChipId = subChipId;
	}

	function editOnPortVariadicCount({ detail }) {
		if (detail.port.chip.id === subChipId) {
			subChipId = subChipId;
		}
	}

	$effect(() => {
		stableChip = chip;
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
	// Data

	// TODO interface if there is no edit

	let subChip = $derived(edit.getChip(subChipId));
	let subChipInputPorts = $derived(
		Array.from(subChip.in)
			.filter((port) => port.isData)
			.map((port) => port.variadic || port)
			.flat()
			.map((port) => ({
				port,
				isConnected: edit.hasConnections(port),
			})),
	);
	let variadicPort = $derived(Array.from(subChip.in).find((port) => port.variadic));
</script>

<div class="Chip-Id">
	<h4>ID</h4>
	<StringInput
		value={subChip.id}
		validate={(value) => edit.setChipId(subChip, value, true)}
		on:input={(e) => edit.setChipId(subChip, e.detail.value)}
	/>
</div>

{#if subChipInputPorts.length > 0}
	<div class="Chip-InputValues">
		<h4>Input values</h4>
		{#each subChipInputPorts as { port, isConnected } (port)}
			<div>
				<div>
					{port.name}
				</div>
				{#if isConnected}
					<div><i>connected</i></div>
				{:else}
					<PortValueInput {edit} {port} />
				{/if}
			</div>
		{/each}
		{#if variadicPort}
			<button type="button" onclick={() => edit.setPortVariadicCount(variadicPort, '+1')}>
				Add
			</button>
			<button type="button" onclick={() => edit.setPortVariadicCount(variadicPort, '-1')}>
				Remove
			</button>
		{/if}
	</div>
{/if}
