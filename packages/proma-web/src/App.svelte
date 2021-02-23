<script>
  // TODO used compiled version instead
  import * as proma from '@proma/core/core/index.mjs';
  import ChipView from './ChipView.svelte';

  const MyChip = proma.chip('MyChip', ({ onCreate }) => {
    const exec = proma.inputFlow('exec');
    const target = proma.inputData('target', { canonical: true });

    const log = new proma.lib.debug.Log();

    proma.wire(onCreate.out.then, log.in.exec);
    proma.wire(exec, log.in.exec);
    proma.wire(target, log.in.message);
  });

  let targetEl;
  $: myChip = targetEl && new MyChip(targetEl);
</script>

<main>
  <div bind:this={targetEl}>
    <h1>Hello!</h1>
    <input type="text" placeholder="What's your name?" />
    <button type="button">Greet me</button>
  </div>
  <ChipView chip={MyChip} />
</main>

<style>
  main {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;

    display: grid;
    grid-template-columns: 1fr 2fr;
    grid-template-rows: 1fr;
  }
</style>
