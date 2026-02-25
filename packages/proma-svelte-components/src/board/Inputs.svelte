<script>
	import { onMount } from 'svelte';
	import { getChip, setChipSide, INPUT } from './context';
	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { children } = $props();

	setChipSide(INPUT);

	const chip = getChip();

	let containerEl = $state();

	onMount(() => {
		const parentEl = containerEl.parentElement;
		containerEl.remove();
		chip.addPortExtras(INPUT, containerEl);
		return () => {
			chip.removePortExtras(INPUT, containerEl);
			if (parentEl) {
				parentEl.appendChild(containerEl);
			}
		};
	});
</script>

<div bind:this={containerEl}>
	{@render children?.()}
</div>
