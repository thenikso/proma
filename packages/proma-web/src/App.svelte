<script>
  // TODO used compiled version instead
  import * as proma from '@proma/core/core/index.mjs';
  import { shortcuts, action } from '@proma/web-controls';
  import Overlay from './components/Overlay.svelte';
  import ChipView from './ChipView.svelte';
  import OutletsView from './OutletsView.svelte';

  const chipClass = proma.chip('MyChip', ({ OnCreate }) => {
    const exec = proma.inputFlow('exec');
    const target = proma.inputData('target', { canonical: true });

    const onCreate = new OnCreate();
    const log = new proma.lib.debug.Log();

    proma.wire(onCreate.out.then, log.in.exec);
    proma.wire(exec, log.in.exec);
    proma.wire(target, log.in.message);
  });

  let targetEl;

  $: chipInstance = targetEl && new chipClass(targetEl);

  let newSubChipRequest;

  //
  // Shortcuts
  //

  shortcuts.set('[MainBoard:chip] backspace', action('ChipView.removeChip'));
  shortcuts.set(
    '[MainBoard:port] alt+click',
    action('ChipView.removeConnection'),
  );

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
    newSubChipRequest = e.detail;
  }

  function handleSelectionChange(e) {
    console.log(e.detail);
  }
</script>

<main>
  <div bind:this={targetEl}>
    <h1>Hello!</h1>
    <input type="text" placeholder="What's your name?" />
    <button type="button">Greet me</button>
  </div>
  <ChipView
    id="MainBoard"
    chip={chipClass}
    on:subChip:request={handleChipRequest}
    on:selection:change={handleSelectionChange}
  />
  <div>
    <OutletsView chip={chipClass} />
  </div>
</main>

{#if newSubChipRequest}
  <Overlay
    anchor={{
      x: newSubChipRequest.clientX - 5,
      y: newSubChipRequest.clientY - 5,
    }}
    on:dismiss={() => (newSubChipRequest = null)}
  >
    <div>
      <div><b>Context chips</b></div>
      {#each newSubChipRequest.chip.customChipClasses as chipClass (chipClass.URI)}
        <div>
          <button
            type="button"
            on:click={() => {
              newSubChipRequest.provideChipInstance(new chipClass());
              newSubChipRequest = null;
            }}
          >
            {chipClass.URI}
          </button>
        </div>
      {/each}
      <div><b>All chips</b></div>
      {#each registryListExcluding(newSubChipRequest.chip) as chipClass (chipClass.URI)}
        <div>
          <button
            type="button"
            on:click={() => {
              newSubChipRequest.provideChipInstance(new chipClass());
              newSubChipRequest = null;
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
