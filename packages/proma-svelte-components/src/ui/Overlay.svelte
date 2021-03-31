<script context="module">
  // TODO onMount of a overlay, hide others
  // TODO onMound stop body events
</script>

<script>
  import { createEventDispatcher } from 'svelte';

  export let anchor = undefined;

  const dispatch = createEventDispatcher();

  function dispatchDismiss() {
    dispatch('dismiss');
  }

  $: overlayStyle = anchor
    ? `
    top: ${anchor.y}px;
    left: ${anchor.x}px;
    `
    : '';
</script>

<div
  class="OverlayContainer"
  on:mousewheel|stopPropagation|preventDefault={dispatchDismiss}
  on:mousedown|stopPropagation={dispatchDismiss}
  on:mouseup|stopPropagation={dispatchDismiss}
  on:click|stopPropagation={dispatchDismiss}
>
  <div
    class="Overlay"
    style={overlayStyle}
    on:mousewheel|stopPropagation
    on:mousedown|stopPropagation
    on:mouseup|stopPropagation
    on:click|stopPropagation
  >
    <slot dismiss={dispatchDismiss} />
  </div>
</div>

<style>
  .OverlayContainer {
    position: fixed;
    overflow: hidden;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 999;
  }

  .Overlay {
    position: absolute;
  }
</style>
