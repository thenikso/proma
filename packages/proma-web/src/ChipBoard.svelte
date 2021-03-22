<script context="module">
  import { action } from '@proma/web-controls';

  action.provide('ChipBoard.removeChip', ({ path: [chipView, chip] }) => {
    for (const c of chip) {
      chipView.removeChip(c.chip);
    }
  });

  action.provide('ChipBoard.removeConnection', ({ path: [chipView, port] }) => {
    chipView.removeConnection(port);
  });

  action.provide('ChipBoard.selectAll', ({ path: [chipView], sourceEvent }) => {
    chipView.selectAllChips();
    // TODO these should got in the action as `action('name', true)` to prevent?
    sourceEvent.stopPropagation();
    sourceEvent.preventDefault();
  });
</script>

<script>
  import { createEventDispatcher } from 'svelte';
  import { createShortcutDispatcher } from '@proma/web-controls';
  import { edit as editChip } from '@proma/core/core/index.mjs';
  import { Board, Chip, Inputs, Outputs, Port, Wire } from '@proma/web-board';
  import PortValueInput from './PortValueInput.svelte';
  import AddPortButton from './components/AddPortButton.svelte';

  export let id = 'ChipBoard';
  export let chip;
  // export let instance = null;

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
    selectAllChips() {
      selectedChipIds = ['$in', '$out', ...edit.allChips().map((c) => c.id)];
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
    // Dispathch selection change event
    const outlets = selectedChipIds
      .filter((id) => id === '$in' || id === '$out')
      .map((id) => outletNameMap[id]);
    const chips = selectedChipIds.filter((id) => !id.startsWith('$'));
    dispatchSelectionChange({
      outlets,
      chips,
      hasSelection: outlets.length > 0 || chips.length > 0,
    });

    // Save selection in metadata
    stableChip.metadata.$.selected = selectedChipIds;
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
  // TODO With this we update all ports if anything chagnes, we can do better
  let updatePortsKey = 1;
  // We store port.variadic as arrays to allow for reactivity
  const variadicPorts = {};

  $: if (stableChip !== chip) {
    stableChip = chip;
    inputOutlets = stableChip.inputOutlets;
    outputOutlets = stableChip.outputOutlets;
    innerChips = stableChip.chips;
    connections = stableChip.connections;

    if (!stableChip.metadata) {
      stableChip.metadata = {};
    }
    stableChip.metadata = Object.assign(
      {
        $: {
          panX: 0,
          panY: 0,
          zoom: 1,
        },
        $in: { x: -400, y: 0 },
        $out: { x: -400, y: 0 },
        ...Object.fromEntries(
          chip.chips.map((c, i) => [c.id, { x: 0, y: 100 * i }]),
        ),
      },
      stableChip.metadata,
    );

    // Restore selection from metadata
    selectedChipIds = stableChip.metadata.$.selected;

    if (edit) {
      edit.off();
    }
    edit = editChip(stableChip);
    edit.on(
      'chip',
      (e) => {
        if (e.detail.operation === 'id') {
          stableChip.metadata[e.detail.id] =
            stableChip.metadata[e.detail.oldId];
          delete stableChip.metadata[e.detail.oldId];
        }
        innerChips = stableChip.chips;
        connections = stableChip.connections;
        updatePortsKey++;
      },
      true,
    );
    edit.on('connection', () => {
      connections = stableChip.connections;
      updatePortsKey++;
    });
    edit.on(
      'outlet',
      () => {
        inputOutlets = stableChip.inputOutlets;
        outputOutlets = stableChip.outputOutlets;
        connections = stableChip.connections;
      },
      true,
    );
    edit.on(
      'port:variadicCount',
      ({ detail }) => {
        variadicPorts[variadicRefName(detail.port)] = Array.from(
          detail.port.variadic,
        );
        connections = stableChip.connections;
      },
      true,
    );
  }

  function connectionId({ source, sink }) {
    return source.port.fullName + '->' + sink.port.fullName;
  }

  //
  // Medatada
  //

  function meta(port) {
    if (!chip.metadata[port.chip.id]) {
      chip.metadata[port.chip.id] = {};
    }
    return chip.metadata[port.chip.id];
  }

  //
  // Variadic ports
  //

  function variadicRefName(port) {
    return `${port.chip.id}__${metaVariadicSizeName(port)}`;
  }

  function metaVariadicSizeName(port) {
    return `${port.isInput ? 'in' : 'out'}_${port.name}_variadicSize`;
  }

  function getPortVariadicSize(port) {
    const variadicSize = metaVariadicSizeName(port);
    if (!meta(port)[variadicSize]) {
      meta(port)[variadicSize] = 2;
    }
    return Math.max(port.variadic.length, meta(port)[variadicSize], 2);
  }

  function prepareVariadicPort(port) {
    const variadicSize = getPortVariadicSize(port);
    edit.setPortVariadicCount(port, variadicSize);
    variadicPorts[variadicRefName(port)] = Array.from(port.variadic);
    return port;
  }

  function addVariadicPort(port) {
    edit.setPortVariadicCount(port, '+1');
  }

  //
  // Event handlers
  //

  function handleBoardContextmenu({
    detail: { boardX, boardY, fromChip, fromSide, fromPort, fromType, event },
  }) {
    let portToConnect;
    const fromTypeKind = fromType;
    if (fromChip && fromSide && fromPort) {
      portToConnect = edit.getPort(makePortPath(fromChip, fromSide, fromPort));
      fromType = portToConnect.type;
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
      fromTypeKind,
      provideChipInstance(chipInstance) {
        // edit.addChip may change the `chipInstance.id` if already existing
        edit.addChip(chipInstance);
        // Add metadata entry
        chip.metadata[chipInstance.id] = {
          x: boardX,
          y: boardY,
        };
        // pick best port to connect "from" also using types
        let otherPort;
        if (portToConnect) {
          for (const p of chipInstance[fromSide === 'input' ? 'out' : 'in']) {
            if (fromTypeKind === 'exec') {
              if (p.isFlow) {
                otherPort = p;
                break;
              }
            } else {
              if (!p.type || p.type.definitionKind === 'any') {
                otherPort = p;
              } else if (p.type.match(fromType)) {
                otherPort = p;
                break;
              }
            }
          }
          if (otherPort) {
            if (otherPort.variadic) {
              edit.addConnection(portToConnect, otherPort.variadic[0]);
            } else {
              edit.addConnection(portToConnect, otherPort);
            }
          }
        }
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

  function shouldHideName(port) {
    return port.isFlow
      ? port.name === 'exec' || port.name === 'then'
      : port.name === 'handle';
  }

  function getChipKind(innerChip) {
    if (innerChip.customChipKind === 'event') {
      return 'delegate';
    }
    if (innerChip.isDataless) {
      return 'control';
    }
    return 'default';
  }
</script>

<div {id} class="ChipBoard">
  <Board
    refreshKey={updatePortsKey}
    on:board:contextmenu={handleBoardContextmenu}
    on:wire:start={handleWireStart}
    on:wire:probe={handleWireProbe}
    on:wire:end={handleWireEnd}
    bind:selectedChips={selectedChipIds}
    bind:panX={chip.metadata.$.panX}
    bind:panY={chip.metadata.$.panY}
    bind:zoom={chip.metadata.$.zoom}
  >
    {#if inputOutlets.length > 0}
      <Chip
        id="$in"
        title="Input"
        kind="outlet"
        bind:x={chip.metadata.$in.x}
        bind:y={chip.metadata.$in.y}
      >
        <Outputs>
          {#each inputOutlets as outlet}
            <Port
              name={outlet.name}
              type={getPortType(outlet)}
              hideName={shouldHideName(outlet)}
            />
          {/each}
        </Outputs>
      </Chip>
    {/if}

    {#each innerChips as innerChip (innerChip.id)}
      <Chip
        id={innerChip.id}
        title={innerChip.label}
        kind={getChipKind(innerChip)}
        bind:x={chip.metadata[innerChip.id].x}
        bind:y={chip.metadata[innerChip.id].y}
      >
        {#if innerChip.in.length > 0}
          <Inputs>
            {#each innerChip.in as port}
              {#if !port.variadic}
                <Port
                  name={port.name}
                  type={getPortType(port)}
                  hideName={shouldHideName(port)}
                >
                  {#if updatePortsKey && port.isData && !edit.hasConnections(port)}
                    <PortValueInput {edit} {port} />
                  {/if}
                </Port>
              {:else if prepareVariadicPort(port)}
                {#each variadicPorts[variadicRefName(port)] as variadicPort}
                  <Port
                    name={variadicPort.name}
                    type={getPortType(variadicPort)}
                  >
                    {#if updatePortsKey && variadicPort.isData && !edit.hasConnections(variadicPort)}
                      <PortValueInput {edit} port={variadicPort} />
                    {/if}
                  </Port>
                {/each}
                <AddPortButton on:click={() => addVariadicPort(port)} />
              {/if}
            {/each}
          </Inputs>
        {/if}
        {#if innerChip.out.length > 0}
          <Outputs>
            {#each innerChip.out as port}
              {#if !port.variadic}
                <Port
                  name={port.name}
                  type={getPortType(port)}
                  hideName={shouldHideName(port)}
                  showOnHeader={port.name === 'handle'}
                />
              {:else if prepareVariadicPort(port)}
                {#each variadicPorts[variadicRefName(port)] as variadicPort}
                  <Port
                    name={variadicPort.name}
                    type={getPortType(variadicPort)}
                  />
                {/each}
                <AddPortButton on:click={() => addVariadicPort(port)} />
              {/if}
            {/each}
          </Outputs>
        {/if}
      </Chip>
    {/each}

    {#if outputOutlets.length > 0}
      <Chip
        id="$out"
        title="Output"
        kind="outlet"
        bind:x={chip.metadata.$out.x}
        bind:y={chip.metadata.$out.y}
      >
        <Inputs>
          {#each outputOutlets as outlet}
            <Port
              name={outlet.name}
              type={getPortType(outlet)}
              hideName={shouldHideName(outlet)}
            />
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
  .ChipBoard {
    position: relative;
    width: 100%;
    height: 100%;
  }
</style>
