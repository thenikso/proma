<script>
	import { onMount } from 'svelte';
	import { getChip, setChipSide, OUTPUT } from './context';

	setChipSide(OUTPUT);

	const chip = getChip();

	let containerEl;

	onMount(() => {
		const parentEl = containerEl.parentElement;
		containerEl.remove();
		chip.addPortExtras(OUTPUT, containerEl);
		return () => {
			chip.removePortExtras(OUTPUT, containerEl);
			if (parentEl) {
				parentEl.appendChild(containerEl);
			}
		};
	});
</script>

<div bind:this={containerEl}>
	<slot />
</div>
