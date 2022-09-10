<script>
  import { StringInput, PortOutlet } from '@proma/svelte-components';
  import { edit as promaEdit } from '@proma/core';

  export let chip;

  $: edit = chip && promaEdit(chip);
  $: inputOutlets = chip.inputOutlets;
  $: outputOutlets = chip.outputOutlets;
</script>

<div>input</div>
{#each inputOutlets as outlet, index}
  <div class="port">
    <StringInput
      placeholder="Port name"
      value={outlet.name}
      validate={(v) => edit.renameOutlet(outlet, v, true)}
      on:input={(e) => edit.renameOutlet(outlet, e.detail.value)}
    />
    <PortOutlet type={outlet.isFlow ? 'exec' : outlet.type.definitionKind} />
    {#if outlet.isData}
      <StringInput
        placeholder="type"
        value={outlet.type.signatureWithLabels}
      />
    {/if}
  </div>
{/each}

<div>outputs</div>
{#each outputOutlets as outlet}
  <div>{outlet.name}</div>
{/each}

<style>
  .port {
    display: grid;
    grid-template-columns: 2fr auto 1fr;
    grid-template-rows: 1fr;
    gap: 10px;
    align-items: center;
    margin: 8px 0;
  }
</style>
