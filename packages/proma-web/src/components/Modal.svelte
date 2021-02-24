<script context="module">
  // TODO onMount of a modal, hide others
  // TODO onMound stop body events
</script>

<script>
  import { createEventDispatcher } from 'svelte';

  export let anchor = undefined;

  const dispatch = createEventDispatcher();

  function dispatchDismiss() {
    dispatch('dismiss');
  }

  $: modalStyle = anchor
    ? `
    top: ${anchor.y}px;
    left: ${anchor.x}px;
    `
    : '';
</script>

<div
  class="ModalContainer"
  on:mousewheel|stopPropagation={dispatchDismiss}
  on:mousedown|stopPropagation={dispatchDismiss}
  on:mouseup|stopPropagation={dispatchDismiss}
  on:click|stopPropagation={dispatchDismiss}
>
  <div
    class="Modal"
    style={modalStyle}
    on:mousewheel|stopPropagation
    on:mousedown|stopPropagation
    on:mouseup|stopPropagation
    on:click|stopPropagation
  >
    <slot dismiss={dispatchDismiss} />
  </div>
</div>

<style>
  .ModalContainer {
    position: fixed;
    overflow: hidden;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
  }

  .Modal {
    position: absolute;
    overflow: auto;

    border: 1px solid gray;
    border-radius: 4px;
    background-color: white;
    box-shadow: 0 3px 3px rgba(0, 0, 0, 0.3);
  }
</style>
