<script>
  import { createEventDispatcher } from 'svelte';
  import { setBoard, INPUT, OUTPUT } from './lib/context';
  import { shortUID } from './lib/utils';
  import WirePath from './WirePath.svelte';

  export let zoom = 1;
  export let minZoom = 0.7;
  export let maxZoom = 2;
  export let snap = 5;
  export let newWirePath = WirePath;
  export let shortcuts = {};

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

  function dispatchShortcuts(event) {
    // Match event
    const matchedEvents = resolvedShortcuts.filter(({ matchEvent }) =>
      matchEvent(event),
    );
    if (matchedEvents.length === 0) return;
    // Prepare targets
    let targets = getEventTargets(event, true);
    if (
      targets.length === 1 &&
      selectedChips.size > 0 &&
      (event.type === 'keydown' || event.type === 'keyup')
    ) {
      targets.unshift(Array.from(selectedChips));
    }
    targets = targets[0];
    if (!Array.isArray(targets)) targets = [targets];
    // Check targets
    for (const { matchTarget, actions } of matchedEvents) {
      // Account for selected chip target array
      if (matchTarget(targets[0].type)) {
        for (const t of targets) {
          const details = makeDispatchDetail(t.eventDetails, event);
          for (const action of actions) {
            dispatch(action, details);
          }
          if (event.cancelBubble) return;
        }
        // Match only the top most target
        return;
      }
    }
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
  // Shortcuts
  //

  const shortcutTargetRegExp = /^(?:\[(.+)\])?\s*(.+)$/;

  $: resolvedShortcuts = Object.entries(shortcuts || {}).reduce(
    (acc, [shortcut, actions]) => {
      const [, targetsString, eventsString] =
        shortcutTargetRegExp.exec(shortcut) || [];
      if (!eventsString) {
        console.warn(
          `Invalid Proma-Board shortcut: "${shortcut}": "${actions}"`,
        );
        return acc;
      }
      const targets = targetsString
        ? targetsString.split(',').map((s) => s.trim().toLocaleLowerCase())
        : ['*'];
      const eventsMatchers = eventsString
        .split(',')
        .map(makeShortcutEventMatcher);
      const matchTarget = targets.includes('*')
        ? () => true
        : (t) => targets.includes(t);
      const matchEvent = (e) => eventsMatchers.some((m) => m(e));
      acc.push({ matchTarget, matchEvent, actions: actions.split(',') });
      return acc;
    },
    [],
  );

  function makeShortcutEventMatcher(eventString) {
    // parts = ['alt', 'click'];
    const parts = eventString.split('+').map((s) => s.trim().toLowerCase());
    const matchers = parts.map((part) => {
      switch (part) {
        case 'click':
          return (e) => e.type === 'click';
        case 'contextmenu':
          return (e) => e.type === 'contextmenu';
        case 'alt':
          return (e) => e.altKey;
        case 'ctrl':
          return (e) => e.ctrlKey;
        case 'cmd':
        case 'meta':
        case 'win':
          return (e) => e.metaKey;
        default:
          return (e) => e.type === 'keydown' && e.key.toLowerCase() === part;
      }
    });
    return function shortcutEventMatcher(event) {
      for (let i = 0, l = matchers.length; i < l; i++) {
        if (!matchers[i](event)) {
          return false;
        }
      }
      return true;
    };
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
    },
    deselectChip(chip) {
      selectedChips.delete(chip);
    },
    // Wires
    addWire(outputChip, outputPort, inputChip, inputPort, wirePath, color, id) {
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
      const type = outputPort.dataType;
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
          color,
          ...wirePoints({ outputPort, inputPort }),
        },
      ];
      outputPort.connectionCount++;
      inputPort.connectionCount++;
      return id;
    },
    probeNewWire(e) {
      if (newWireFromPoint) {
        const target = getEventTargets(e, true)[0];
        if (newWireProbeEnd === target) return;
        newWireProbeEnd = target;
        dispatchWireProbe(target.eventDetails, e);
      }
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
    // Handlers
    drag(e) {
      panX += e.dragX;
      panY += e.dragY;
    },
    keyDown(e) {
      if (e.code === 'Space') {
        grab = true;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    keyUp(e) {
      if (e.code === 'Space') {
        grab = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    mouseUp(e) {
      if (newWireFromPort) {
        board.endNewWire(null, e);
      }
      e.stopPropagation();
      e.preventDefault();
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
    mouseUp(e) {
      if (!e.didDrag) {
        deselectAllChips();
      }
      selectionRect = null;
    },
    drag(e) {
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
            if (
              intersectRect(selectionElRect, chipEl.getBoundingClientRect())
            ) {
              chip.select();
              selectedChips.add(chip);
            } else {
              chip.deselect();
            }
          }
        }
      }
      e.stopPropagation();
    },
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
  // Event target
  //

  function getEventTargets(e, straightPath) {
    if (grab) {
      return [board];
    }
    // Get event path (with firefox fix)
    let path = e.path;
    if (!path) {
      path = [];
      let cursor = e.target;
      while (cursor) {
        path.unshift(cursor);
        cursor = cursor.parentElement;
      }
    }
    // Map to known objects
    const promaPath = [];
    for (const p of path) {
      if (p.$promaPort) {
        promaPath.push(p.$promaPort);
      } else if (p.$promaChip) {
        if (!straightPath && selectedChips.has(p.$promaChip)) {
          promaPath.push(Array.from(selectedChips));
        } else {
          promaPath.push(p.$promaChip);
        }
      }
    }
    if (e.button === 0) {
      promaPath.push(selection);
    }
    promaPath.push(board);
    return promaPath;
  }

  function withEventTargets(targetsPath, f, e) {
    for (const target of targetsPath) {
      if (Array.isArray(target)) {
        for (const t of target) {
          if (t[f]) {
            t[f](e);
          }
        }
      } else if (target[f]) {
        target[f](e);
      }
      if (e.cancelBubble) break;
    }
  }

  function hasEventTarget(targets, type) {
    if (targets) {
      for (const target of targets) {
        if (target.type === type) {
          return true;
        }
      }
    }
    return false;
  }

  //
  // Dragging and other interaction event handlers
  //

  let draggingEventTargets;
  let draggingStart;
  let dragging;
  let zoomRaw = zoom;

  function handleMouseDown(e) {
    draggingEventTargets = getEventTargets(e);
    draggingStart = dragging = { x: e.pageX, y: e.pageY };
    withEventTargets(draggingEventTargets, 'mouseDown', e);
  }

  function handleMouseMove(e) {
    if (!dragging) {
      return;
    }

    const dragY = e.pageY - dragging.y;
    const dragX = e.pageX - dragging.x;

    withEventTargets(
      draggingEventTargets,
      'drag',
      Object.assign(e, {
        dragStartX: draggingStart.x,
        dragStartY: draggingStart.y,
        dragX,
        dragY,
        zoom,
        snap,
      }),
    );

    dragging = { x: e.pageX, y: e.pageY };
  }

  function handleMouseUp(e) {
    draggingEventTargets = getEventTargets(e);
    withEventTargets(
      draggingEventTargets,
      'mouseUp',
      Object.assign(e, {
        didDrag:
          draggingStart &&
          (draggingStart.x !== e.pageX || draggingStart.y !== e.pageY),
      }),
    );
    handleMouseLeave(e);
  }

  function handleMouseLeave(e) {
    if (newWireFromPort) {
      newWireFromPort.connectionCount--;
    }
    newWireFromPort = null;
    draggingStart = null;
    dragging = null;
    draggingEventTargets = null;
  }

  function handleMouseWheel(e) {
    if (e.ctrlKey) {
      const prevZoom = zoomRaw;
      const delta = e.deltaY * 2;
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
      panX -= e.deltaX;
      panY -= e.deltaY;
    }
  }

  function handleKeydown(e) {
    const targets = getEventTargets(e);
    dispatchShortcuts(e);
    withEventTargets(targets, 'keyDown', e);
  }

  function handleKeyup(e) {
    const targets = getEventTargets(e);
    withEventTargets(targets, 'keyUp', e);
  }

  function handleContextmenu(e) {
    dispatchShortcuts(e);
    e.preventDefault();
    e.stopPropagation();
  }

  function handleClick(e) {
    const targets = getEventTargets(e);
    dispatchShortcuts(e);
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
  on:mousedown={handleMouseDown}
  on:mouseup={handleMouseUp}
  on:mousemove={handleMouseMove}
  on:mouseleave={handleMouseLeave}
  on:mousewheel|preventDefault={handleMouseWheel}
  on:dragstart|preventDefault
  on:keydown={handleKeydown}
  on:keyup={handleKeyup}
  on:contextmenu={handleContextmenu}
  on:click={handleClick}
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
    {#each wires as { id, wirePath, fromPoint, toPoint, type, color } (id)}
      <svelte:component this={wirePath} {fromPoint} {toPoint} {type} {color} />
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
        color={newWireFromPort.color}
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
