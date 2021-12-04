<script context="module">
  import { action } from '../actions';

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
  import { onDestroy, createEventDispatcher } from 'svelte';
  import { createShortcutDispatcher } from '../shortcuts';
  import { Board, Chip, Inputs, Outputs, Port, Wire } from '../board';
  import PortValueInput from '../inputs/PortValueInput.svelte';
  import AddPortButton from '../ui/AddPortButton.svelte';

  export let id = 'ChipBoard';
  export let chip;
  export let edit;
  // export let instance = null;

  //
  // Dispatchers
  //

  const dispatch = createEventDispatcher();

  function dispatchMetadataChange(detail) {
    dispatch('metadata:change', detail);
  }

  function dispatchSubChipAddRequest(detail) {
    dispatch('subChip:request', detail);
  }

  function dispatchSelectionChange(detail) {
    dispatch('selection:change', detail);
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
  // Stable chip
  //

  // A chip that stay stable with its reference (instead of changing if we modify metadata or similar)
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

    metadata = cloneMetadata(stableChip);
    selectedChipIds = metadata.$.selected;
  }

  //
  // Metadata
  //

  let metadata;

  $: metadata && updateChipMetadata(metadata);

  function updateChipMetadata(metadata) {
    if (edit) {
      chip.metadata = metadata;
    }
    dispatchMetadataChange({ chip, metadata });
  }

  function meta(port) {
    if (!metadata[port.chip.id]) {
      metadata[port.chip.id] = {};
    }
    return metadata[port.chip.id];
  }

  function cloneMetadata(chip) {
    return {
      ...(chip?.metadata ?? {}),
      $: {
        panX: 0,
        panY: 0,
        zoom: 1,
        ...(chip?.metadata?.$ ?? {}),
        selected: [...(chip?.metadata?.$?.selected || [])],
      },
      $in: { x: -400, y: 0, ...(chip?.metadata?.$in ?? {}) },
      $out: { x: -400, y: 0, ...(chip?.metadata?.$out ?? {}) },
      ...Object.fromEntries(
        chip.chips.map((c, i) => [
          c.id,
          { x: 0, y: 100 * i, ...(chip?.metadata?.[c.id] ?? {}) },
        ]),
      ),
    };
  }

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
    metadata.$.selected = selectedChipIds;
  }

  //
  // Edit
  //

  let oldEdit;
  // TODO With this we update all ports if anything chagnes, we can do better
  let updatePortsKey = 1;

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
    edit.on('chip', editOnChip, true);
    edit.on('connection', editOnConnection);
    edit.on('outlet', editOnOutlet, true);
    edit.on('port:variadicCount', editOnPortVariadicCount, true);
  }

  function editDestroy(edit) {
    edit.off('chip', editOnChip, true);
    edit.off('connection', editOnConnection);
    edit.off('outlet', editOnOutlet, true);
    edit.off('port:variadicCount', editOnPortVariadicCount, true);
  }

  function editOnChip(e) {
    if (e.detail.operation === 'id') {
      stableChip.metadata[e.detail.id] = stableChip.metadata[e.detail.oldId];
      delete stableChip.metadata[e.detail.oldId];
    }
    innerChips = stableChip.chips;
    connections = stableChip.connections;
    updatePortsKey++;
  }

  function editOnConnection() {
    connections = stableChip.connections;
    updatePortsKey++;
  }

  function editOnOutlet() {
    inputOutlets = stableChip.inputOutlets;
    outputOutlets = stableChip.outputOutlets;
    connections = stableChip.connections;
  }

  function editOnPortVariadicCount({ detail }) {
    variadicPorts[variadicRefName(detail.port)] = Array.from(
      detail.port.variadic,
    );
    connections = stableChip.connections;
  }

  //
  // Variadic ports
  //

  // We store port.variadic as arrays to allow for reactivity
  const variadicPorts = {};

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
    if (edit) {
      edit.setPortVariadicCount(port, variadicSize);
    }
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
        metadata[chipInstance.id] = {
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

  function connectionId({ source, sink }) {
    return source.port.fullName + '->' + sink.port.fullName;
  }

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

{#key stableChip && stableChip.URI}
  <div {id} class="ChipBoard">
    <Board
      refreshKey={updatePortsKey}
      on:board:contextmenu={handleBoardContextmenu}
      on:wire:start={handleWireStart}
      on:wire:probe={handleWireProbe}
      on:wire:end={handleWireEnd}
      bind:selectedChips={selectedChipIds}
      bind:panX={metadata.$.panX}
      bind:panY={metadata.$.panY}
      bind:zoom={metadata.$.zoom}
    >
      {#if inputOutlets.length > 0}
        <Chip
          id="$in"
          title="Input"
          kind="outlet"
          bind:x={metadata.$in.x}
          bind:y={metadata.$in.y}
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
          bind:x={metadata[innerChip.id].x}
          bind:y={metadata[innerChip.id].y}
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
                    {#if edit && updatePortsKey && port.isData && !edit.hasConnections(port)}
                      <PortValueInput {edit} {port} />
                    {/if}
                  </Port>
                {:else if prepareVariadicPort(port)}
                  {#each variadicPorts[variadicRefName(port)] as variadicPort}
                    <Port
                      name={variadicPort.name}
                      type={getPortType(variadicPort)}
                    >
                      {#if edit && updatePortsKey && variadicPort.isData && !edit.hasConnections(variadicPort)}
                        <PortValueInput {edit} port={variadicPort} />
                      {/if}
                    </Port>
                  {/each}
                  {#if edit}
                    <AddPortButton on:click={() => addVariadicPort(port)} />
                  {/if}
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
                  {#if edit}
                    <AddPortButton on:click={() => addVariadicPort(port)} />
                  {/if}
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
          bind:x={metadata.$out.x}
          bind:y={metadata.$out.y}
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
{/key}

<style>
  .ChipBoard {
    position: relative;
    width: 100%;
    height: 100%;
  }
</style>
