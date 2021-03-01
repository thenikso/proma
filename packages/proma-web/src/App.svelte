<script>
  // TODO used compiled version instead
  import * as proma from '@proma/core/core/index.mjs';
  import Overlay from './components/Overlay.svelte';
  import ChipView from './ChipView.svelte';
  import OutletsView from './OutletsView.svelte';

  const MyChip = proma.chip('MyChip', ({ OnCreate }) => {
    const exec = proma.inputFlow('exec');
    const target = proma.inputData('target', { canonical: true });

    const onCreate = new OnCreate();
    const log = new proma.lib.debug.Log();

    proma.wire(onCreate.out.then, log.in.exec);
    proma.wire(exec, log.in.exec);
    proma.wire(target, log.in.message);
  });

  let targetEl;
  $: myChip = targetEl && new MyChip(targetEl);

  let chipRequest;

  //
  // Listing chips
  //

  let registryList = proma.registry.list();

  function registryListExcluding(chipToExclude) {
    return registryList.filter((c) => c !== chipToExclude);
  }

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
  <div>
    <OutletsView />
  </div>
</main>

{#if chipRequest}
  <Overlay
    anchor={{ x: chipRequest.clientX - 5, y: chipRequest.clientY - 5 }}
    on:dismiss={() => (chipRequest = null)}
  >
    <div>
      <div><b>Context chips</b></div>
      {#each chipRequest.chip.customChipClasses as chipClass (chipClass.URI)}
        <div>
          <button
            type="button"
            on:click={() => {
              chipRequest.provideChipInstance(new chipClass());
              chipRequest = null;
            }}
          >
            {chipClass.URI}
          </button>
        </div>
      {/each}
      <div><b>All chips</b></div>
      {#each registryListExcluding(chipRequest.chip) as chipClass (chipClass.URI)}
        <div>
          <button
            type="button"
            on:click={() => {
              chipRequest.provideChipInstance(new chipClass());
              chipRequest = null;
            }}
          >
            {chipClass.URI}
          </button>
        </div>
      {/each}
    </div>
  </Overlay>
{/if}

<style>
  main {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;

    display: grid;
    grid-template-columns: 1fr 2fr 300px;
    grid-template-rows: 1fr;
  }
</style>
