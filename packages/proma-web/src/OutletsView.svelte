<script>
  import { NameInput } from '@proma/web-controls';

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
    edit = stableChip.edit();
    edit.on('port', () => {
      inputOutlets = stableChip.inputOutlets;
      outputOutlets = stableChip.outputOutlets;
    });
  }
</script>

<section>
  <header>Inputs</header>
  {#each inputOutlets as outlet}
    <div>
      <NameInput
        value={outlet.name}
        placeholder="Port name"
        validate={(name) => edit.renamePort(outlet, name, true)}
        on:input={(event) => edit.renamePort(outlet, event.detail.value)}
      />
    </div>
  {/each}
</section>

<section>
  <header>Outputs</header>
  {#each outputOutlets as outlet}
    <div>
      <NameInput value={outlet.name} placeholder="Port name" />
    </div>
  {/each}
</section>
