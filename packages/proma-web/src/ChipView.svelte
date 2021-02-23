<script>
  import { Board, Chip, Inputs, Outputs, Port, Wire } from '@proma/web-board';

  export let chip;
  export let instance = null;

  let inputOutlets = chip.inputOutlets;
  let outputOutlets = chip.outputOutlets;
  let innerChips = chip.chips;
  let connections = chip.connections;

  //
  // Medatada
  //

  // $: inputMetachip = (chip.metatadata || {}).$in || {
  //   x: -400,
  //   y: 0,
  // };
  // $: outputMetachip = (chip.metatadata || {}).$out || {
  //   x: 400,
  //   y: 0,
  // };
  // $: chip.metadata = {
  //   $in: inputMetachip,
  //   $out: outputMetachip,
  // };
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
</script>

<Board>
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

  {#each connections as { source, sink }}
    <Wire
      outputChip={source.chip ? source.chip.id : '$in'}
      outputPort={source.port.name}
      inputChip={sink.chip ? sink.chip.id : '$out'}
      inputPort={sink.port.name}
    />
  {/each}
</Board>
