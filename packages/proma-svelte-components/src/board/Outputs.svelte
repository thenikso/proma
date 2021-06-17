<script>
  import { onMount } from 'svelte';
  import { getChip, setChipSide, OUTPUT } from './context';

  setChipSide(OUTPUT);

  const chip = getChip();

  let containerEl;

  onMount(() => {
    containerEl.remove();
    chip.addPortExtras(OUTPUT, containerEl);
    return () => {
      chip.removePortExtras(OUTPUT, containerEl);
    };
  });
</script>

<div bind:this={containerEl}>
  <slot />
</div>
