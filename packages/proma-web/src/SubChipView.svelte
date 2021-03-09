<script>
  import { edit as editChip } from '@proma/core/core/index.mjs';
  import { StringInput } from '@proma/web-controls';
  import PortValueInput from './PortValueInput.svelte';

  export let chip;
  export let subChipId;

  let stableChip;
  let edit;
  let subChip;

  $: if (chip !== stableChip) {
    stableChip = chip;
    edit = editChip(stableChip);
  }

  $: subChip = edit.getChip(subChipId);
  $: subChipInputPorts = Array.from(subChip.in)
    .map((port) => port.variadic || port)
    .flat()
    .map((port) => ({
      port,
      isConnected: edit.hasConnections(port),
    }));
</script>

<div class="Chip-Id">
  <h4>ID</h4>
  <StringInput
    value={subChip.id}
    validate={(value) => {
      edit.setChipId(subChip, value, true);
      return value;
    }}
    on:input={(e) => edit.setChipId(subChip, e.detail.value)}
  />
</div>

{#if subChipInputPorts.length > 0}
  <div class="Chip-InputValues">
    <h4>Input values</h4>
    {#each subChipInputPorts as { port, isConnected } (port)}
      <div>
        <div>
          {port.name}
        </div>
        {#if isConnected}
          <div><i>connected</i></div>
        {:else}
          <PortValueInput {edit} {port} />
        {/if}
      </div>
    {/each}
  </div>
{/if}
