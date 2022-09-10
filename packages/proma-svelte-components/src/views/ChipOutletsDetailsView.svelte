<script>
  import { onDestroy } from 'svelte';
  import { StringInput } from '../inputs';

  export let chip;
  export let edit;

  //
  // Init chip editing
  //

  let stableChip;
  let inputOutlets;
  let outputOutlets;

  $: if (stableChip !== chip) {
    stableChip = chip;
    inputOutlets = stableChip.inputOutlets;
    outputOutlets = stableChip.outputOutlets;
  }

  let oldEdit;

  $: if (edit !== oldEdit) {
    if (oldEdit) {
      editDestroy(oldEdit);
    }
    oldEdit = edit;
    editMount(edit);
  }

  onDestroy(() => {
    if (oldEdit) {
      editDestroy(oldEdit);
    }
  });

  function editMount(edit) {
    edit.on('outlet', editOnOutlet);
  }

  function editDestroy(edit) {
    edit.off('outlet', editOnOutlet);
  }

  function editOnOutlet() {
    inputOutlets = stableChip.inputOutlets;
    outputOutlets = stableChip.outputOutlets;
  }
</script>

<section>
  <header>Inputs</header>
  {#each inputOutlets as outlet}
    <div>
      <StringInput
        value={outlet.name}
        placeholder="Port name"
        validate={(name) => edit.renameOutlet(outlet, name, true)}
        on:input={(event) => edit.renameOutlet(outlet, event.detail.value)}
      />
    </div>
  {/each}
</section>

<section>
  <header>Outputs</header>
  {#each outputOutlets as outlet}
    <div>
      <StringInput value={outlet.name} placeholder="Port name" />
    </div>
  {/each}
</section>
