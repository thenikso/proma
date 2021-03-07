<script>
  import { onMount, onDestroy } from 'svelte';
  import { getBoard, setChip, INPUT, OUTPUT } from './lib/context';
  import I from './Inputs.svelte';
  import O from './Outputs.svelte';
  import { shortUID } from './lib/utils';

  export const Inputs = I;
  export const Outputs = O;

  export let id = shortUID();
  export let selected = false;
  export let x = 0;
  export let y = 0;
  export let color = '#3a764f';
  export let title = 'Chip';
  export let icon = null;

  let chipEl;
  let rawX;
  let rawY;
  let inputContainerEl;
  let outputContainerEl;
  let headerOutputContainerEl;

  let inputExtrasContainerEl;
  let outputExtrasContainerEl;
  let inputExtrasEls = [];
  let outputExtrasEls = [];

  const board = getBoard();

  const chip = setChip({
    type: 'chip',
    board,
    id,
    get eventDetails() {
      return {
        chip: id,
      };
    },
    select() {
      selected = true;
    },
    deselect() {
      selected = false;
    },
    //
    movePosition(deltaX, deltaY, snap) {
      if (!rawX) {
        rawX = x;
        rawY = y;
      }
      rawX += deltaX;
      rawY += deltaY;
      if (snap > 0) {
        x = Math.round(rawX / snap) * snap;
        y = Math.round(rawY / snap) * snap;
      } else {
        x = rawX;
        y = rawY;
      }
    },
    addPort(side, portEl, showOnHeader) {
      switch (side) {
        case INPUT:
          inputContainerEl.appendChild(portEl);
          break;
        case OUTPUT:
          if (showOnHeader) {
            headerOutputContainerEl.appendChild(portEl);
          } else {
            outputContainerEl.appendChild(portEl);
          }
          break;
        default:
          throw new Error(`Invalid port side "${side}"`);
      }
    },
    removePort(side, portEl) {
      switch (side) {
        case INPUT:
          inputContainerEl.removeChild(portEl);
          break;
        case OUTPUT:
          headerOutputContainerEl.removeChild(portEl);
          outputContainerEl.removeChild(portEl);
          break;
        default:
          throw new Error(`Invalid port side "${side}"`);
      }
    },
    getPort(side, name) {
      let portEl;
      switch (side) {
        case INPUT:
          portEl = inputContainerEl.getElementsByClassName('Port-' + name)[0];
          break;
        case OUTPUT:
          portEl = outputContainerEl.getElementsByClassName('Port-' + name)[0];
          if (!portEl) {
            portEl = headerOutputContainerEl.getElementsByClassName(
              'Port-' + name,
            )[0];
          }
          break;
        default:
          throw new Error(`Invalid port side "${side}"`);
      }
      if (!portEl) return null;
      return portEl.$promaPort;
    },

    // Port extras
    addPortExtras(side, el) {
      switch (side) {
        case INPUT:
          inputExtrasEls = [...inputExtrasEls, el];
          break;
        case OUTPUT:
          outputExtrasEls = [...outputExtrasEls, el];
          break;
        default:
          throw new Error(`Invalid side "${side}"`);
      }
    },
    removePortExtras(side, el) {
      let index;
      switch (side) {
        case INPUT:
          index = inputExtrasEls.indexOf(el);
          if (index >= 0) {
            inputExtrasEls = [
              ...inputExtrasEls.slice(0, index),
              ...inputExtrasEls.slice(index + 1),
            ];
          }
          break;
        case OUTPUT:
          index = outputExtrasEls.indexOf(el);
          if (index >= 0) {
            outputExtrasEls = [
              ...outputExtrasEls.slice(0, index),
              ...outputExtrasEls.slice(index + 1),
            ];
          }
          break;
        default:
          throw new Error(`Invalid side "${side}"`);
      }
    },
  });

  onMount(() => {
    chipEl.$promaChip = chip;
  });

  onDestroy(() => {
    board.deselectChip(chip);
  });

  $: if (selected) {
    board.selectChip(chip);
  } else {
    board.deselectChip(chip);
    rawX = 0;
    rawY = 0;
  }

  $: hasPortExtras = inputExtrasEls.length > 0 || outputExtrasEls.length > 0;
  $: syncChildrens(inputExtrasContainerEl, inputExtrasEls);
  $: syncChildrens(outputExtrasContainerEl, outputExtrasEls);

  function syncChildrens(container, els) {
    if (!container) return;
    const children = Array.from(container.children);
    for (const el of children) {
      if (!els.includes(el)) el.remove();
    }
    let ref = null;
    for (const el of els) {
      if (children.includes(el)) continue;
      container.insertBefore(el, ref);
      ref = el;
    }
  }
</script>

<div
  bind:this={chipEl}
  class="Chip Chip-{id}"
  class:selected
  style="transform: translate3d({x}px, {y}px, 0)"
>
  <div class="ChipBody">
    <div class="ChipHeader" style="background-color: {color}">
      {#if icon}
        <svelte:component this={icon} />
      {/if}
      <div class="ChipHeaderTitle">
        <div class="title">{title}</div>
        <div class="subtitle" />
      </div>
      <div
        class="ChipHeaderPorts ChipOutputPorts"
        bind:this={headerOutputContainerEl}
      />
    </div>
    <div class="ChipPorts">
      <div class="ChipInputPorts" bind:this={inputContainerEl} />
      <div class="ChipOutputPorts" bind:this={outputContainerEl} />
    </div>
    {#if hasPortExtras}
      <div class="ChipPorts ChpPortsExtras">
        <div class="ChipInputPorts" bind:this={inputExtrasContainerEl} />
        <div class="ChipOutputPorts" bind:this={outputExtrasContainerEl} />
      </div>
    {/if}
    <div class="ChipExtra">
      <slot />
    </div>
  </div>
</div>

<style>
  .Chip {
    position: absolute;
    box-sizing: border-box;

    font-size: 14px;
    color: white;

    background: rgba(62, 62, 62, 0.7);
    box-shadow: 0 2px 1px rgba(29, 29, 29, 0.8);

    border-radius: 5px;
    border: 1px solid rgba(29, 29, 29, 0.7);

    user-select: none;
    cursor: move;
  }

  .Chip * {
    box-sizing: border-box;
  }

  .Chip.selected {
    z-index: 1;
  }

  .Chip:hover {
    z-index: 2;
  }

  .Chip.selected:before {
    content: '';
    position: absolute;
    top: -6px;
    left: -6px;
    right: -6px;
    bottom: -6px;

    box-shadow: 0 0 3px rgba(0, 0, 0, 0.8);

    border: 5px solid transparent;
    border-radius: 10px;
    background: linear-gradient(to right, #3e3e3e, #3e3e3e),
      linear-gradient(15deg, #f17814, #e9b03d);
    background-clip: padding-box, border-box;
    background-origin: padding-box, border-box;
  }

  .ChipBody {
    position: relative;
  }

  .ChipHeader {
    display: flex;
    align-items: baseline;

    color: white;
    font-size: 16px;
    padding: 3px 2px;

    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    border-bottom: 1px solid #343434;
  }

  .ChipHeader > div {
    padding: 0 2px;
  }

  .ChipHeaderTitle {
    flex-grow: 2;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ChipHeaderTitle .title {
    font-weight: 400;
  }

  .ChipHeaderTitle .subtitle {
    font-style: italic;
    font-weight: 300;
    font-size: 13px;
    opacity: 0.7;
  }

  .ChipPorts {
    display: grid;
    grid-template-rows: 100%;
    grid-template-columns: 1fr 1fr;
    grid-gap: 40px;
    padding: 3px;
  }

  .ChipInputPorts {
    text-align: left;
  }

  .ChipOutputPorts {
    text-align: right;
  }
</style>
