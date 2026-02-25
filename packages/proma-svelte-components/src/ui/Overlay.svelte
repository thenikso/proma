<script module>
	const overlayContainerEl = document.createElement('div');
	overlayContainerEl.className = 'OverlayContainer';
	overlayContainerEl.style.position = 'fixed';
	overlayContainerEl.style.overflow = 'hidden';
	overlayContainerEl.style.top = '0';
	overlayContainerEl.style.left = '0';
	overlayContainerEl.style.width = '100vw';
	overlayContainerEl.style.height = '100vh';
	overlayContainerEl.style.zIndex = '999';

	let dismissFunction;
	function handleDismissOverlay(e) {
		e.preventDefault();
		e.stopPropagation();
		if (dismissFunction) {
			dismissFunction();
		}
	}
	overlayContainerEl.addEventListener('mousewheel', handleDismissOverlay);
	overlayContainerEl.addEventListener('mousedown', handleDismissOverlay);
	overlayContainerEl.addEventListener('mouseup', handleDismissOverlay);
	overlayContainerEl.addEventListener('click', handleDismissOverlay);

	function showOverlay(el, dismiss) {
		if (overlayContainerEl.firstChild) {
			overlayContainerEl.firstChild.remove();
		}
		dismissFunction = dismiss;
		overlayContainerEl.appendChild(el);
		if (!overlayContainerEl.parentNode) {
			document.body.appendChild(overlayContainerEl);
		}
	}

	function hideOverlay() {
		if (overlayContainerEl.parentNode) {
			overlayContainerEl.remove();
		}
		dismissFunction = null;
	}
</script>

<script>
	import { createBubbler, stopPropagation } from 'svelte/legacy';

	const bubble = createBubbler();
	import { onMount, createEventDispatcher } from 'svelte';

	let { anchor = undefined, children } = $props();

	const dispatch = createEventDispatcher();

	function dispatchDismiss() {
		dispatch('dismiss');
	}

	let overlayPositionStyle = $derived(anchor ? `top: ${anchor.y}px; left: ${anchor.x}px;` : '');

	let overlayEl = $state();
	let overlayFixStyle = $state('');

	onMount(() => {
		showOverlay(overlayEl, dispatchDismiss);
		// Fix overlay position to keep it fully visible
		const overlayRect = overlayEl.getBoundingClientRect();
		const viewportHeight = document.documentElement.clientHeight;
		if (overlayRect.bottom > viewportHeight) {
			overlayFixStyle = `transform: translate(0, ${viewportHeight - overlayRect.bottom}px);`;
		}
		return () => {
			hideOverlay();
		};
	});
</script>

<div
	bind:this={overlayEl}
	class="Overlay"
	style={overlayPositionStyle + overlayFixStyle}
	onmousewheel={stopPropagation(bubble('mousewheel'))}
	onmousedown={stopPropagation(bubble('mousedown'))}
	onmouseup={stopPropagation(bubble('mouseup'))}
	onclick={stopPropagation(bubble('click'))}
	onkeydown={stopPropagation(bubble('keydown'))}
	role="dialog"
	tabindex="0"
>
	{@render children?.({ dismiss: dispatchDismiss })}
</div>

<style>
	.Overlay {
		position: absolute;
		max-height: 100vh;
	}
</style>
