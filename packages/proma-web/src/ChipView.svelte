<script>
  import { createEventDispatcher } from 'svelte';
  import { Board, Chip, Inputs, Outputs, Port, Wire } from '@proma/web-board';

  export let chip;
  export let instance = null;

  const shortcuts = {
    '[port] alt+click': 'port:delete',
    '[chip] delete,backspace': 'chip:delete',
  };

  //
  // Dispatchers
  //

  const dispatch = createEventDispatcher();

  function dispatchChange(chip) {
    dispatch('change', { chip });
  }

  //
  // Data
  //

  let stableChip;
  let inputOutlets;
  let outputOutlets;
  let innerChips;
  let connections;
  $: if (stableChip !== chip) {
    stableChip = chip;
    inputOutlets = stableChip.inputOutlets;
    outputOutlets = stableChip.outputOutlets;
    innerChips = stableChip.chips;
    connections = stableChip.connections;
  }

  let edit;
  $: {
    if (edit) {
      edit.off();
    }
    edit = stableChip.edit();
    edit.on('chip', () => {
      innerChips = stableChip.chips;
      connections = stableChip.connections;
    });
    edit.on('connection', () => {
      connections = stableChip.connections;
    });
  }

  function connectionId({ source, sink }) {
    return source.port.fullName + '->' + sink.port.fullName;
  }

  // $: console.log(connections.map(connectionId));

  //
  // Medatada
  //

  $: if (!chip.metadata) {
    chip.metadata = {
      $in: { x: -400, y: 0 },
      $out: { x: -400, y: 0 },
      ...Object.fromEntries(
        chip.chips.map((c, i) => [c.id, { x: 0, y: 100 * i }]),
      ),
    };
  }

  // $: console.log(chip.toJSON());

  //
  // Event handlers
  //

  function handleChipDelete({ detail: { chip } }) {
    if (chip === '$in' || chip === '$out') return;
    edit.removeChip(chip);
  }

  function handlePortDelete({ detail }) {
    edit.removeConnection([
      detail.chip.startsWith('$') ? undefined : detail.chip,
      detail.side === 'input' ? 'in' : 'out',
      detail.name,
    ]);
  }

  function handleWireStart({ detail }) {
    console.log('start', detail);
  }

  function handleWireProbe({ detail }) {
    console.log('probe', detail);
  }

  function handleWireEnd({ detail }) {
    console.log('end', detail);
  }
</script>

<Board
  {shortcuts}
  on:chip:delete={handleChipDelete}
  on:port:delete={handlePortDelete}
  on:wire:start={handleWireStart}
  on:wire:probe={handleWireProbe}
  on:wire:end={handleWireEnd}
>
  {#if inputOutlets.length > 0}
    <Chip
      id="$in"
      title="Input"
      bind:x={chip.metadata.$in.x}
      bind:y={chip.metadata.$in.y}
    >
      <Outputs>
        {#each inputOutlets as outlet (outlet.name)}
          <Port name={outlet.name} />
        {/each}
      </Outputs>
    </Chip>
  {/if}

  {#each innerChips as innerChip (innerChip.id)}
    <Chip
      id={innerChip.id}
      title={innerChip.id}
      bind:x={chip.metadata[innerChip.id].x}
      bind:y={chip.metadata[innerChip.id].y}
    >
      {#if innerChip.in.length > 0}
        <Inputs>
          {#each innerChip.in as port}
            <Port name={port.name} />
          {/each}
        </Inputs>
      {/if}
      {#if innerChip.out.length > 0}
        <Outputs>
          {#each innerChip.out as port}
            <Port name={port.name} />
          {/each}
        </Outputs>
      {/if}
    </Chip>
  {/each}

  {#if outputOutlets.length > 0}
    <Chip
      id="$out"
      title="Output"
      bind:x={chip.metadata.$out.x}
      bind:y={chip.metadata.$out.y}
    >
      <Inputs>
        {#each outputOutlets as outlet (outlet.name)}
          <Port name={outlet.name} />
        {/each}
      </Inputs>
    </Chip>
  {/if}

  {#each connections as conn (connectionId(conn))}
    <Wire
      outputChip={conn.source.chip ? conn.source.chip.id : '$in'}
      outputPort={conn.source.port.name}
      inputChip={conn.sink.chip ? conn.sink.chip.id : '$out'}
      inputPort={conn.sink.port.name}
    />
  {/each}
</Board>
