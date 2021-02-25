<script>
  import { createEventDispatcher } from 'svelte';
  import { Board, Chip, Inputs, Outputs, Port, Wire } from '@proma/web-board';

  export let chip;
  export let instance = null;

  const shortcuts = {
    '[port] alt+click': 'port:delete',
    '[chip] delete,backspace': 'chip:delete',
    '[board] contextmenu': 'board:contextmenu',
  };

  //
  // Dispatchers
  //

  const dispatch = createEventDispatcher();

  function dispatchChange(chip) {
    dispatch('change', { chip });
  }

  function dispatchChipRequest(detail) {
    dispatch('chipRequest', detail);
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

  function handleBoardContextmenu({
    detail: { boardX, boardY, fromChip, fromSide, fromPort, event },
  }) {
    dispatchChipRequest({
      chip,
      clientX: event.clientX,
      clientY: event.clientY,
      boardX,
      boardY,
      fromChip,
      fromSide,
      fromPort,
      provideChipInstance(chipInstance) {
        chip.metadata[chipInstance.id] = {
          x: boardX,
          y: boardY,
        };
        edit.addChip(chipInstance);
        // TODO pick best port to connect "from" also using types
      },
    });
  }

  function handleChipDelete({ detail: { chip } }) {
    if (chip === '$in' || chip === '$out') return;
    edit.removeChip(chip);
  }

  function handlePortDelete({ detail }) {
    edit.removeConnection(makePortPath(detail.chip, detail.side, detail.name));
  }

  function handleWireStart({ detail }) {
    // TODO highlight available ports
    // console.log('start', detail);
  }

  function handleWireProbe({ detail }) {
    // TODO Update tooltip to show possible connection results
    // console.log('probe', detail);
  }

  function handleWireEnd(event) {
    const {
      detail: { fromChip, fromSide, fromPort, toChip, toSide, toPort },
    } = event;
    if (fromChip === toChip && fromSide === toSide) return;
    if (!toPort) {
      // Forward to new chip creation
      return handleBoardContextmenu(event);
    }
    try {
      edit.addConnection(
        makePortPath(fromChip, fromSide, fromPort),
        makePortPath(toChip, toSide, toPort),
      );
    } catch (error) {
      // TODO catch erros, show notification
      console.error(error);
    }
  }

  //
  // Utilities
  //

  function makePortPath(chipId, side, portName) {
    const isMetaChip = chipId === '$in' || chipId === '$out';
    return [
      isMetaChip ? undefined : chipId,
      (side === 'input') ^ isMetaChip ? 'in' : 'out',
      portName,
    ];
  }

  function getPortType(port) {
    if (port.isFlow) return 'exec';
    // TODO return port type as string
    if (port.type) {
      return port.type.definitionKinds[0];
    }
    return 'any';
  }
</script>

<div class="ChipView">
  <Board
    {shortcuts}
    on:board:contextmenu={handleBoardContextmenu}
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
            <Port name={outlet.name} type={getPortType(outlet)} />
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
              <Port name={port.name} type={getPortType(port)} />
            {/each}
          </Inputs>
        {/if}
        {#if innerChip.out.length > 0}
          <Outputs>
            {#each innerChip.out as port}
              <Port name={port.name} type={getPortType(port)} />
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
            <Port name={outlet.name} type={getPortType(outlet)} />
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
  <slot />
</div>

<style>
  .ChipView {
    position: relative;
    width: 100%;
    height: 100%;
  }
</style>
