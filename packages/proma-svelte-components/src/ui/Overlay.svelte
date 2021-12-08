<script context="module">
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

  let originalParent;

  function showOverlay(el, dismiss) {
    if (overlayContainerEl.firstChild) {
      overlayContainerEl.firstChild.remove();
    }
    dismissFunction = dismiss;
    originalParent = el.parentNode;
    overlayContainerEl.appendChild(el);
    if (!overlayContainerEl.parentNode) {
      document.body.appendChild(overlayContainerEl);
    }
  }

  function hideOverlay() {
    if (overlayContainerEl.firstChild) {
      if (originalParent) {
        originalParent.appendChild(overlayContainerEl.firstChild);
      } else {
        overlayContainerEl.firstChild.remove();
      }
    }
    if (overlayContainerEl.parentNode) {
      overlayContainerEl.remove();
    }
    originalParent = null;
    dismissFunction = null;
  }
</script>

<script>
  import { onMount, createEventDispatcher } from 'svelte';

  export let anchor = undefined;

  const dispatch = createEventDispatcher();

  function dispatchDismiss() {
    dispatch('dismiss');
  }

  $: overlayPositionStyle = anchor
    ? `top: ${anchor.y}px; left: ${anchor.x}px;`
    : '';

  let overlayEl;
  let overlayFixStyle = '';

  onMount(() => {
    showOverlay(overlayEl, dispatchDismiss);
    // Fix overlay position to keep it fully visible
    const overlayRect = overlayEl.getBoundingClientRect();
    const viewportHeight = document.documentElement.clientHeight;
    if (overlayRect.bottom > viewportHeight) {
      overlayFixStyle = `transform: translate(0, ${
        viewportHeight - overlayRect.bottom
      }px);`;
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
  on:mousewheel|stopPropagation
  on:mousedown|stopPropagation
  on:mouseup|stopPropagation
  on:click|stopPropagation
>
  <slot dismiss={dispatchDismiss} />
</div>

<style>
  .Overlay {
    position: absolute;
    max-height: 100vh;
  }
</style>
