<script>
  import { onMount } from 'svelte';
  import { getChip, setChipSide, INPUT } from './lib/context';

  setChipSide(INPUT);

  const chip = getChip();

  let containerEl;

  onMount(() => {
    containerEl.remove();
    chip.addPortExtras(INPUT, containerEl);
    return () => {
      chip.removePortExtras(INPUT, containerEl);
      containerEl.style.display = 'none';
      document.body.appendChild(containerEl);
    };
  });
</script>

<div bind:this={containerEl}>
  <slot />
</div>
