<script>
  import { onMount } from 'svelte';
  import { getChip, setChipSide, OUTPUT } from './lib/context';

  setChipSide(OUTPUT);

  const chip = getChip();

  let containerEl;

  onMount(() => {
    containerEl.remove();
    chip.addPortExtras(OUTPUT, containerEl);
    return () => {
      chip.removePortExtras(OUTPUT, containerEl);
      containerEl.style.display = 'none';
      document.body.appendChild(containerEl);
    };
  });
</script>

<div bind:this={containerEl}>
  <slot />
</div>
