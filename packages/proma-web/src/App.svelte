<script>
  // TODO used compiled version instead
  import * as proma from '@proma/core/core/index.mjs';
  import ChipView from './ChipView.svelte';
  import Modal from './components/Modal.svelte';

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

  let chipRequest;

  //
  // Event handlers
  //

  function handleChipRequest(e) {
    chipRequest = e.detail;
  }
</script>

<main>
  <div bind:this={targetEl}>
    <h1>Hello!</h1>
    <input type="text" placeholder="What's your name?" />
    <button type="button">Greet me</button>
  </div>
  <ChipView chip={MyChip} on:chipRequest={handleChipRequest} />
</main>

{#if chipRequest}
  <Modal
    anchor={{ x: chipRequest.clientX, y: chipRequest.clientY }}
    on:dismiss={() => (chipRequest = null)}
  >
    <div>
      <div><b>Context chips</b></div>
      {#each chipRequest.chip.inactiveIngressChips as chip (chip.id)}
        <div>
          <button
            type="button"
            on:click={() => {
              chipRequest.provideChipInstance(chip);
              chipRequest = null;
            }}>{chip.chipURI}</button
          >
        </div>
      {/each}
      <div><b>All chips</b></div>
      {#each proma.registry.list() as chipClass (chipClass.URI)}
        <div>
          <button
            type="button"
            on:click={() => {
              chipRequest.provideChipInstance(new chipClass());
              chipRequest = null;
            }}>{chipClass.URI}</button
          >
        </div>
      {/each}
    </div>
  </Modal>
{/if}

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
