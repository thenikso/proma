<script>
  import { onMount } from 'svelte';
  import { getBoard } from './lib/context';
  import WirePath from './WirePath.svelte';

  export let outputChip;
  export let outputPort;
  export let inputChip;
  export let inputPort;
  export let path = WirePath;

  const board = getBoard();

  let id;

  onMount(() => {
    id = board.addWire(
      outputChip,
      outputPort,
      inputChip,
      inputPort,
      path,
    );
    return () => {
      if (id) {
        board.removeWire(id);
      }
    };
  });

  // $: id = board.addWire(outputChip, outputPort, inputChip, inputPort, path, id);
</script>
