<script>
  import { createEventDispatcher } from 'svelte';
  import { createShortcutDispatcher } from '@proma/web-controls';
  import { setBoard, INPUT, OUTPUT } from './lib/context';
  import { shortUID } from './lib/utils';
  import WirePath from './WirePath.svelte';

  export let zoom = 1;
  export let minZoom = 0.7;
  export let maxZoom = 2;
  export let snap = 5;
  export let newWirePath = WirePath;

  //
  // Dispatchers
  //

  const dispatch = createEventDispatcher();

  function dispatchWireStart(detail) {
    dispatch('wire:start', detail);
  }

  // When dragging a new wire on top of a new element
  function dispatchWireProbe(detail, event) {
    dispatch('wire:probe', makeDispatchDetail(detail, event));
  }

  function dispatchWireEnd(detail, event) {
    dispatch('wire:end', makeDispatchDetail(detail, event));
  }

  function dispatchContextmenu(sourceType, detail, event) {
    dispatch(`${sourceType}:contextmenu`, makeDispatchDetail(detail, event));
  }

  function makeDispatchDetail(detail, event) {
    const { x: boardX, y: boardY } = clientPointToBoardPoint(
      event.clientX,
      event.clientY,
    );
    return Object.assign(
      {
        event,
        boardX,
        boardY,
      },
      detail,
    );
  }

  //
  // Selected chips
  //

  const selectedChips = new Set();

  function deselectAllChips() {
    for (const chip of selectedChips) {
      chip.deselect();
    }
  }

  //
  // Board
  //

  const board = setBoard({
    type: 'board',
    // Chip
    selectChip(chip, e) {
      if (selectedChips.has(chip)) return;
      if (!e || !e.shiftKey) {
        deselectAllChips();
        selectedChips.clear();
      }
      selectedChips.add(chip);
      chip.select();
    },
    deselectChip(chip) {
      selectedChips.delete(chip);
    },
    // Wires
    addWire(outputChip, outputPort, inputChip, inputPort, wirePath, id) {
      if (typeof outputChip === 'string') {
        outputChip = boardContentEl.getElementsByClassName(
          'Chip-' + outputChip,
        )[0].$promaChip;
      }
      if (typeof outputPort === 'string') {
        outputPort = outputChip.getPort(OUTPUT, outputPort);
      }
      if (typeof inputChip === 'string') {
        inputChip = boardContentEl.getElementsByClassName(
          'Chip-' + inputChip,
        )[0].$promaChip;
      }
      if (typeof inputPort === 'string') {
        inputPort = inputChip.getPort(INPUT, inputPort);
      }
      if (id) {
        board.removeWire(id);
      } else {
        id = `wire-${shortUID()}`;
      }
      const type =
        outputPort.dataType === inputPort.dataType
          ? inputPort.dataType
          : `${outputPort.dataType}-to-${inputPort.dataType}`;
      wires = [
        ...wires,
        {
          id,
          outputChip,
          outputPort,
          inputChip,
          inputPort,
          type,
          wirePath,
          ...wirePoints({ outputPort, inputPort }),
        },
      ];
      outputPort.connectionCount++;
      inputPort.connectionCount++;
      return id;
    },
    removeWire(id) {
      const wireIndex = wires.findIndex((w) => w.id === id);
      let wire;
      if (wireIndex >= 0) {
        wire = wires[wireIndex];
        wires = [...wires.slice(0, wireIndex), ...wires.slice(wireIndex + 1)];
        // TODO only if not connected somewhere else
        wire.outputPort.connectionCount--;
        wire.inputPort.connectionCount--;
      }
      return wire;
    },
    updateWires(limitChip) {
      cancelAnimationFrame(updateWiresTimer);
      updateWiresLimit = limitChip;
      updateWiresTimer = requestAnimationFrame(updateWiresPoints);
    },
    //
    startNewWire(port) {
      if (newWireFromPort) return false;
      newWireFromPort = port;
      newWireFromPort.connectionCount++;
      dispatchWireStart({
        chip: port.chip.id,
        port: port.name,
      });
      return true;
    },
    probeNewWire(target, e) {
      if (newWireFromPoint) {
        if (newWireProbeEnd === target) return;
        newWireProbeEnd = target;
        dispatchWireProbe(target.eventDetails, e);
      }
    },
    endNewWire(port, e) {
      if (!newWireFromPort) return false;
      const detail = {
        fromChip: newWireFromPort.chip.id,
        fromSide: newWireFromPort.side,
        fromPort: newWireFromPort.name,
        toChip: port && port.chip.id,
        toSide: port && port.side,
        toPort: port && port.name,
      };
      dispatchWireEnd(detail, e);
      newWireFromPort.connectionCount--;
      newWireFromPort = null;
      return true;
    },
  });

  //
  // Selection
  //

  let boardContentEl;
  let selectionEl;
  let selectionRect;

  const selection = {
    type: 'selection',
  };

  function selectionRectFromPoints({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    if (x1 === x2 && y1 === y2) {
      return null;
    }
    return {
      ...clientPointToBoardPoint(Math.min(x1, x2), Math.min(y1, y2)),
      width: Math.abs(x1 - x2) / zoom,
      height: Math.abs(y1 - y2) / zoom,
    };
  }

  function intersectRect(r1, r2) {
    return !(
      r2.left > r1.right ||
      r2.right < r1.left ||
      r2.top > r1.bottom ||
      r2.bottom < r1.top
    );
  }

  //
  // Wires
  //

  let wires = [];
  let wiresEl;
  let updateWiresTimer;
  let updateWiresLimit;
  let newWireFromPort;
  // Used in `board.probeNewWire` to store the last probed element and send a new
  // event if it changes.
  let newWireProbeEnd;

  $: wiresViewBox = `${(-(boardWidth || 0) / 2 - panX) / zoom} ${
    (-(boardHeight || 0) / 2 - panY) / zoom
  } ${(boardWidth || 0) / zoom} ${(boardHeight || 0) / zoom}`;
  $: newWireFromPoint =
    newWireFromPort && getElementCenter(newWireFromPort.outletElement);

  function updateWiresPoints() {
    for (const wire of wires) {
      if (
        !updateWiresLimit ||
        wire.inputChip === updateWiresLimit ||
        wire.outputChip === updateWiresLimit
      ) {
        Object.assign(wire, wirePoints(wire));
      }
    }
    updateWiresLimit = null;
    // To force redraw
    // TODO make more efficient
    wires = [...wires];
  }

  function wirePoints(wire) {
    const fromPoint = getElementCenter(wire.outputPort.outletElement);
    const toPoint = getElementCenter(wire.inputPort.outletElement);
    return {
      fromPoint,
      toPoint,
    };
  }

  function getElementCenter(el) {
    if (!el) {
      return null;
    }
    const bbox = el.getBoundingClientRect();
    const x = bbox.x + bbox.width / 6; // not exactly the center
    const y = bbox.y + bbox.height / 2;
    return clientPointToBoardPoint(x, y);
  }

  //
  // Styling
  //

  let boardEl;
  let boardWidth;
  let boardHeight;
  let panX = 0;
  let panY = 0;
  let grab = false;

  $: style = `
  background-position: ${boardWidth / 2 + panX}px ${boardHeight / 2 + panY}px;
  background-size: ${zoom * 100}px;
  cursor: ${grab ? (dragging ? 'grabbing' : 'grab') : 'default'};
  `;

  $: wrapperStyle = `
  transform: translate3d(${panX}px, ${panY}px, 0) scale(${zoom});
  `;

  $: if (boardEl) {
    // Fix for Chrome not updating height correctly
    requestAnimationFrame(
      () => (boardHeight = boardEl.getBoundingClientRect().height),
    );
  }

  //
  // Shortctus and event handling
  //

  let draggingEventTargets;
  let draggingStart;
  let dragging;
  let zoomRaw = zoom;

  const NEWdispatchShortcuts = createShortcutDispatcher(
    [
      { id: 'board', select: board, present: { type: 'board' } },
      {
        id: 'selection',
        select: (e) => (e.button === 0 ? selection : null),
        present: { type: 'selection' },
      },
      {
        id: 'chip',
        select: (e) =>
          e.path.filter((p) => p.$promaChip).map((p) => p.$promaChip)[0],
        present: (c) => c.eventDetails,
      },
      {
        id: 'chip',
        select: (e, pathSoFar) =>
          e.type === 'keydown' &&
          !pathSoFar.includes('chip') &&
          selectedChips.size > 0 &&
          Array.from(selectedChips),
        present: (c) => c.map((x) => x.eventDetails),
      },
      {
        id: 'port',
        select: (e) =>
          e.path.filter((p) => p.$promaPort).map((p) => p.$promaPort)[0],
        present: (c) => c.eventDetails,
      },
    ],
    {
      '[port|chip|selection] mousedown': ({ target, sourceEvent }) => {
        draggingStart = dragging = {
          x: sourceEvent.pageX,
          y: sourceEvent.pageY,
        };
        if (target.type === 'port') {
          if (
            !sourceEvent.altKey &&
            !sourceEvent.ctrlKey &&
            !sourceEvent.metaKey &&
            sourceEvent.button === 0
          ) {
            board.startNewWire(target);
            boardEl.addEventListener('mousemove', handleDragPort);
          }
        } else if (target.type === 'chip') {
          board.selectChip(target, sourceEvent);
          boardEl.addEventListener('mousemove', handleDragChip);
        } else if (!grab) {
          boardEl.addEventListener('mousemove', handleDragSelection);
        } else {
          boardEl.addEventListener('mousemove', handleDragBoard);
        }
      },
      '[chip|selection] mouseup': ({ target }) => {
        if (!selectionRect && target.type === 'selection') {
          deselectAllChips();
        }
        selectionRect = null;
      },
      '[board] keydown+space': ({ sourceEvent }) => {
        if (!grab) {
          grab = true;
        }
        sourceEvent.stopPropagation();
        sourceEvent.preventDefault();
      },
      '[board] keyup+space': ({ sourceEvent }) => {
        if (grab) {
          grab = false;
          boardMouseLeaveAction();
          sourceEvent.stopPropagation();
          sourceEvent.preventDefault();
        }
      },
      '[port|board] mousemove': ({ target, sourceEvent }) => {
        board.probeNewWire(target, sourceEvent);
      },
      '[port|board] mouseup': ({ target, sourceEvent }) => {
        if (newWireFromPort) {
          board.endNewWire(target.type === 'port' ? target : null, sourceEvent);
        }
        boardMouseLeaveAction();
      },
      '[board] mouseleave': boardMouseLeaveAction,
      '[board] mousewheel': ({ sourceEvent }) => {
        if (sourceEvent.ctrlKey) {
          const prevZoom = zoomRaw;
          const delta = sourceEvent.deltaY * 2;
          zoomRaw -= delta / 100;
          if (zoomRaw > maxZoom) {
            zoomRaw = maxZoom;
          } else if (zoomRaw < minZoom) {
            zoomRaw = minZoom;
          }
          if (prevZoom !== zoomRaw) {
            panX += delta;
            panY += delta;
          }
          zoom = Math.abs(zoomRaw - 1) < 0.05 ? 1 : zoomRaw;
        } else {
          panX -= sourceEvent.deltaX;
          panY -= sourceEvent.deltaY;
        }
      },
      '[port|chip|board] contextmenu': ({ target, sourceEvent }) => {
        sourceEvent.preventDefault();
        dispatchContextmenu(target.type, target.eventDetails, sourceEvent);
      },
    },
  );

  function handleDragPort(event) {
    NEWdispatchShortcuts(event);

    dragging = { x: event.pageX, y: event.pageY };
  }

  function handleDragChip(event) {
    const deltaX = (event.pageX - dragging.x) / zoom;
    const deltaY = (event.pageY - dragging.y) / zoom;
    for (const chip of selectedChips) {
      chip.movePosition(deltaX, deltaY, snap);
      board.updateWires(chip);
    }
    dragging = { x: event.pageX, y: event.pageY };
  }

  function handleDragSelection(event) {
    selectionRect = selectionRectFromPoints(draggingStart, dragging);

    // TODO throttle?
    if (selectionEl) {
      const selectionElRect = selectionEl.getBoundingClientRect();
      selectedChips.clear();
      const children = boardContentEl.children;
      for (let i = 0, l = children.length; i < l; i++) {
        const chipEl = children[i];
        const chip = chipEl.$promaChip;
        if (chip) {
          if (intersectRect(selectionElRect, chipEl.getBoundingClientRect())) {
            chip.select();
            selectedChips.add(chip);
          } else {
            chip.deselect();
          }
        }
      }
    }

    dragging = { x: event.pageX, y: event.pageY };
  }

  function handleDragBoard(event) {
    panX += event.pageX - dragging.x;
    panY += event.pageY - dragging.y;

    dragging = { x: event.pageX, y: event.pageY };
  }

  function boardMouseLeaveAction() {
    if (newWireFromPort) {
      newWireFromPort.connectionCount--;
    }
    newWireFromPort = null;
    draggingStart = null;
    dragging = null;
    grab = false;

    boardEl.removeEventListener('mousemove', handleDragPort);
    boardEl.removeEventListener('mousemove', handleDragChip);
    boardEl.removeEventListener('mousemove', handleDragSelection);
    boardEl.removeEventListener('mousemove', handleDragBoard);
  }

  //
  // Utils
  //

  function clientPointToBoardPoint(x, y) {
    if (typeof x === 'object') {
      y = x.y;
      x = x.x;
    }
    const {
      x: boardX,
      y: boardY,
      width,
      height,
    } = boardEl.getBoundingClientRect();
    return {
      x: (x - boardX - width / 2 - panX) / zoom,
      y: (y - boardY - height / 2 - panY) / zoom,
    };
  }
</script>

<div
  tabindex="-1"
  class="Board"
  class:grab
  {style}
  bind:this={boardEl}
  bind:offsetWidth={boardWidth}
  bind:offsetHeight={boardHeight}
  on:mousedown={NEWdispatchShortcuts}
  on:mouseup={NEWdispatchShortcuts}
  on:mouseleave={NEWdispatchShortcuts}
  on:mousewheel|preventDefault={NEWdispatchShortcuts}
  on:dragstart|preventDefault
  on:keydown={NEWdispatchShortcuts}
  on:keyup={NEWdispatchShortcuts}
  on:contextmenu={NEWdispatchShortcuts}
  on:click={NEWdispatchShortcuts}
>
  <svg
    bind:this={wiresEl}
    class="BoardConnections"
    width="100%"
    height="100%"
    viewBox={wiresViewBox}
    preserveAspectRatio="xMidYMid slice"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
  >
    <defs>
      <linearGradient id="any-to-string">
        <stop offset="0%" stop-color="var(--proma-board--type-any, #00a7ef)" />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-string, #55D67C)"
        />
      </linearGradient>
      <linearGradient id="any-to-number">
        <stop offset="0%" stop-color="var(--proma-board--type-any, #00a7ef)" />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-number, #57acee)"
        />
      </linearGradient>
      <linearGradient id="any-to-boolean">
        <stop offset="0%" stop-color="var(--proma-board--type-any, #00a7ef)" />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-boolean, #eeac57)"
        />
      </linearGradient>
      <linearGradient id="any-to-object">
        <stop offset="0%" stop-color="var(--proma-board--type-any, #00a7ef)" />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-object, #ac57ee)"
        />
      </linearGradient>
      <linearGradient id="any-to-array">
        <stop offset="0%" stop-color="var(--proma-board--type-any, #00a7ef)" />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-array, #bf7df2)"
        />
      </linearGradient>
      <linearGradient id="any-to-tuple">
        <stop offset="0%" stop-color="var(--proma-board--type-any, #00a7ef)" />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-tuple, #cd82a3)"
        />
      </linearGradient>
      <linearGradient id="any-to-function">
        <stop offset="0%" stop-color="var(--proma-board--type-any, #00a7ef)" />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-function, #d6557c)"
        />
      </linearGradient>

      <linearGradient id="string-to-any">
        <stop
          offset="0%"
          stop-color="var(--proma-board--type-string, #55D67C)"
        />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-any, #00a7ef)"
        />
      </linearGradient>
      <linearGradient id="number-to-any">
        <stop
          offset="0%"
          stop-color="var(--proma-board--type-number, #57acee)"
        />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-any, #00a7ef)"
        />
      </linearGradient>
      <linearGradient id="boolean-to-any">
        <stop
          offset="0%"
          stop-color="var(--proma-board--type-boolean, #eeac57)"
        />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-any, #00a7ef)"
        />
      </linearGradient>
      <linearGradient id="object-to-any">
        <stop
          offset="0%"
          stop-color="var(--proma-board--type-object, #ac57ee)"
        />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-any, #00a7ef)"
        />
      </linearGradient>
      <linearGradient id="array-to-any">
        <stop
          offset="0%"
          stop-color="var(--proma-board--type-array, #bf7df2)"
        />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-any, #00a7ef)"
        />
      </linearGradient>
      <linearGradient id="tuple-to-any">
        <stop
          offset="0%"
          stop-color="var(--proma-board--type-tuple, #cd82a3)"
        />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-any, #00a7ef)"
        />
      </linearGradient>
      <linearGradient id="function-to-any">
        <stop
          offset="0%"
          stop-color="var(--proma-board--type-function, #d6557c)"
        />
        <stop
          offset="100%"
          stop-color="var(--proma-board--type-any, #00a7ef)"
        />
      </linearGradient>
    </defs>
    {#each wires as { id, wirePath, fromPoint, toPoint, type } (id)}
      <svelte:component this={wirePath} {fromPoint} {toPoint} {type} />
    {/each}
    {#if newWireFromPoint && dragging}
      <svelte:component
        this={newWirePath}
        fromPoint={newWireFromPort.side === OUTPUT
          ? newWireFromPoint
          : clientPointToBoardPoint(dragging)}
        toPoint={newWireFromPort.side === INPUT
          ? newWireFromPoint
          : clientPointToBoardPoint(dragging)}
        type={newWireFromPort.dataType}
      />
    {/if}
  </svg>
  <div class="BoardWrapper" style={wrapperStyle}>
    <div class="BoardContent" bind:this={boardContentEl}>
      <slot />
    </div>
    {#if selectionRect}
      <div
        bind:this={selectionEl}
        class="BoardSelection"
        style="transform: translate({selectionRect.x}px, {selectionRect.y}px);
        width: {selectionRect.width}px; height: {selectionRect.height}px"
      />
    {/if}
  </div>
</div>

<style>
  .Board {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    min-width: 200px;
    min-height: 200px;
    overscroll-behavior: contain;

    color: white;
    background-color: #2a2a2a;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%234d4d4d' fill-opacity='0.7'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3Cpath d='M6 5V0H5v5H0v1h5v94h1V6h94V5H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
  }

  .Board.grab * {
    pointer-events: none;
  }

  .BoardConnections {
    position: absolute;
    top: 0;
    left: 0;
  }

  .BoardWrapper {
    position: absolute;
    top: 50%;
    left: 50%;
  }

  .BoardSelection {
    position: absolute;
    border: 1px dashed white;
    z-index: 10;
  }
</style>
