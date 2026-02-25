<script>
	import { onMount } from 'svelte';
	import { getChip, setChipSide, OUTPUT } from './context';
	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { children } = $props();

	setChipSide(OUTPUT);

	const chip = getChip();

	let containerEl = $state();

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
	{@render children?.()}
</div>
