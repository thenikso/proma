<script>
	import { onMount } from 'svelte';
	import { getBoard } from './context';
	import WirePath from './WirePath.svelte';

	let { outputChip, outputPort, inputChip, inputPort, path = WirePath } = $props();

	const board = getBoard();

	let id;

	onMount(() => {
		id = board.addWire(outputChip, outputPort, inputChip, inputPort, path);
		return () => {
			if (id) {
				board.removeWire(id);
			}
		};
	});

	// $: id = board.addWire(outputChip, outputPort, inputChip, inputPort, path, id);
</script>
