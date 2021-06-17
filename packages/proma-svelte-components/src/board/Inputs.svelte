<script>
  import { onMount } from 'svelte';
  import { getChip, setChipSide, INPUT } from './context';

  setChipSide(INPUT);

  const chip = getChip();

  let containerEl;

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
  <slot />
</div>
