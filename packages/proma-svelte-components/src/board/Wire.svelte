<script>
	import { onMount } from 'svelte';
	import { getBoard } from './context';
	import WirePath from './WirePath.svelte';

	let { outputChip, outputPort, inputChip, inputPort, path = WirePath } = $props();

	const board = getBoard();

	let id;
	let retryTimer;

	function addWireWithRetry(retriesLeft = 8) {
		if (id) return;
		id = board.addWire(outputChip, outputPort, inputChip, inputPort, path);
		if (!id && retriesLeft > 0) {
			retryTimer = requestAnimationFrame(() => addWireWithRetry(retriesLeft - 1));
		}
	}

	onMount(() => {
		addWireWithRetry();
		return () => {
			cancelAnimationFrame(retryTimer);
			if (id) {
				board.removeWire(id);
			}
		};
	});

	// $: id = board.addWire(outputChip, outputPort, inputChip, inputPort, path, id);
</script>
