<script>
	import { createEventDispatcher, onMount, tick } from 'svelte';

	/**
	 * @typedef {{ x?: number, y?: number, left?: number, top?: number }} Anchor
	 */

	/** @type {{ anchor?: Anchor, children?: import('svelte').Snippet<[any]> }} */
	let { anchor = undefined, children } = $props();

	const dispatch = createEventDispatcher();
	const PADDING = 8;

	let contentEl = $state();
	let overlayEl = $state();
	let contentLeft = $state(PADDING);
	let contentTop = $state(PADDING);

	function dispatchDismiss() {
		dispatch('dismiss');
	}

	function resolveAnchor() {
		if (!anchor) {
			return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
		}
		return {
			x: anchor.x ?? anchor.left ?? PADDING,
			y: anchor.y ?? anchor.top ?? PADDING,
		};
	}

	async function updatePosition() {
		if (!contentEl || typeof window === 'undefined') return;
		await tick();
		const rect = contentEl.getBoundingClientRect();
		const { x, y } = resolveAnchor();
		const maxLeft = Math.max(PADDING, window.innerWidth - rect.width - PADDING);
		const maxTop = Math.max(PADDING, window.innerHeight - rect.height - PADDING);
		contentLeft = Math.min(Math.max(x, PADDING), maxLeft);
		contentTop = Math.min(Math.max(y, PADDING), maxTop);
	}

	function handleBackdropMousedown(event) {
		if (event.currentTarget !== event.target) return;
		dispatchDismiss();
	}

	function handleKeydown(event) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		dispatchDismiss();
	}

	onMount(() => {
		updatePosition();
		overlayEl?.focus();
		window.addEventListener('resize', updatePosition);
		return () => {
			window.removeEventListener('resize', updatePosition);
		};
	});

	$effect(() => {
		anchor;
		updatePosition();
	});
</script>

<div
	bind:this={overlayEl}
	class="fixed inset-0 z-50 bg-black/5"
	role="dialog"
	tabindex="-1"
	onmousedown={handleBackdropMousedown}
	onkeydown={handleKeydown}
>
	<div
		bind:this={contentEl}
		class="absolute max-h-[calc(100vh-1rem)]"
		style="left: {contentLeft}px; top: {contentTop}px;"
	>
		{@render children?.({ dismiss: dispatchDismiss })}
	</div>
</div>
