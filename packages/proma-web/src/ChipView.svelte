<script context="module">
  import { action } from '@proma/web-controls';

  action.provide('ChipView.removeChip', ({ path: [chipView, chip] }) => {
    for (const c of chip) {
      chipView.removeChip(c.chip);
    }
  });

  action.provide('ChipView.removeConnection', ({ path: [chipView, port] }) => {
    chipView.removeConnection(port);
  });
</script>

<script>
  import { createEventDispatcher } from 'svelte';
  import { createShortcutDispatcher } from '@proma/web-controls';
  import { edit as editChip } from '@proma/core/core/index.mjs';
  import { Board, Chip, Inputs, Outputs, Port, Wire } from '@proma/web-board';
  import PortValueInput from './PortValueInput.svelte';

  export let id = 'ChipView';
  export let chip;
  export let instance = null;

  //
  // Dispatchers
  //

  const dispatch = createEventDispatcher();

  function dispatchChange(chip) {
    dispatch('change', { chip });
  }

  function dispatchSubChipAddRequest(detail) {
    dispatch('subChip:request', detail);
  }

  function dispatchSelectionChange(details) {
    dispatch('selection:change', details);
  }

  //
  // Shortcuts target
  //

  const chipView = {
    removeChip(chipId) {
      // TODO remove outlet connections?
      if (chipId === '$in' || chipId === '$out') return;
      edit.removeChip(chipId);
    },
    removeConnection(port) {
      edit.removeConnection(makePortPath(port.chip, port.side, port.name));
    },
  };

  const shortcutDispatcher = createShortcutDispatcher([
    { id, select: chipView },
  ]);

  //
  // Selection
  //

  let selectedChipIds;
  const outletNameMap = {
    $in: 'input',
    $out: 'output',
  };

  $: if (selectedChipIds) {
    const outlets = selectedChipIds
      .filter((id) => id === '$in' || id === '$out')
      .map((id) => outletNameMap[id]);
    const chips = selectedChipIds.filter((id) => !id.startsWith('$'));
    dispatchSelectionChange({
      outlets,
      chips,
      hasSelection: outlets.length > 0 || chips.length > 0,
    });
  }

  //
  // Data
  //

  let stableChip;
  let edit;

  let inputOutlets;
  let outputOutlets;
  let innerChips;
  let connections;
  let updatePortsKey = 1;

  $: if (stableChip !== chip) {
    stableChip = chip;
    inputOutlets = stableChip.inputOutlets;
    outputOutlets = stableChip.outputOutlets;
    innerChips = stableChip.chips;
    connections = stableChip.connections;
    if (edit) {
      edit.off();
    }
    edit = editChip(stableChip);
    edit.on('chip', () => {
      innerChips = stableChip.chips;
      connections = stableChip.connections;
    });
    edit.on('connection', () => {
      connections = stableChip.connections;
      updatePortsKey++;
    });
    edit.on(
      'port',
      () => {
        inputOutlets = stableChip.inputOutlets;
        outputOutlets = stableChip.outputOutlets;
        connections = stableChip.connections;
      },
      true,
    );
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
    detail: { boardX, boardY, fromChip, fromSide, fromPort, fromType, event },
  }) {
    if (fromChip && fromSide && fromPort) {
      fromType = edit.getPort(makePortPath(fromChip, fromSide, fromPort)).type;
    }
    dispatchSubChipAddRequest({
      chip,
      clientX: event.clientX,
      clientY: event.clientY,
      boardX,
      boardY,
      fromChip,
      fromSide,
      fromPort,
      fromType,
      // TODO also accept connection hint
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

<div {id} class="ChipView">
  <Board
    refreshKey={updatePortsKey}
    on:board:contextmenu={handleBoardContextmenu}
    on:wire:start={handleWireStart}
    on:wire:probe={handleWireProbe}
    on:wire:end={handleWireEnd}
    bind:selectedChips={selectedChipIds}
  >
    {#if inputOutlets.length > 0}
      <Chip
        id="$in"
        title="Input"
        color="#446C8F"
        bind:x={chip.metadata.$in.x}
        bind:y={chip.metadata.$in.y}
      >
        <Outputs>
          {#each inputOutlets as outlet}
            <Port name={outlet.name} type={getPortType(outlet)} />
          {/each}
        </Outputs>
      </Chip>
    {/if}

    {#each innerChips as innerChip (innerChip.id)}
      <Chip
        id={innerChip.id}
        title={innerChip.id}
        color={innerChip.constructor.isEvent ? '#b63434' : '#3a764f'}
        bind:x={chip.metadata[innerChip.id].x}
        bind:y={chip.metadata[innerChip.id].y}
      >
        {#if innerChip.in.length > 0}
          <Inputs>
            {#each innerChip.in as port}
              <Port name={port.name} type={getPortType(port)}>
                {#if updatePortsKey && port.isData && port.type && !edit.hasConnections(port)}
                  <PortValueInput {edit} {port} />
                {/if}
              </Port>
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
        color="#446C8F"
        bind:x={chip.metadata.$out.x}
        bind:y={chip.metadata.$out.y}
      >
        <Inputs>
          {#each outputOutlets as outlet}
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
