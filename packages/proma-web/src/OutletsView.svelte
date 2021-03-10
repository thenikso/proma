<script>
  import { edit as editChip } from '@proma/core/core/index.mjs';
  import { StringInput } from '@proma/web-controls';

  export let chip;

  //
  // Init chip editing
  //

  let stableChip;
  let inputOutlets;
  let outputOutlets;
  let edit;

  $: if (stableChip !== chip) {
    stableChip = chip;
    inputOutlets = stableChip.inputOutlets;
    outputOutlets = stableChip.outputOutlets;
    if (edit) {
      edit.off();
    }
    edit = editChip(stableChip);
    edit.on('outlet', () => {
      inputOutlets = stableChip.inputOutlets;
      outputOutlets = stableChip.outputOutlets;
    });
  }
</script>

<section>
  <header>Inputs</header>
  {#each inputOutlets as outlet}
    <div>
      <StringInput
        value={outlet.name}
        placeholder="Port name"
        validate={(name) => {
          edit.renameOutlet(outlet, name, true);
          return name;
        }}
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
