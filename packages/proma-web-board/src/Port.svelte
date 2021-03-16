<script>
  import { onMount } from 'svelte';
  import { getChipWithSide, INPUT, OUTPUT } from './lib/context';
  import PortOutlet from './PortOutlet.svelte';

  export let name;
  export let type = 'any';
  export let connected = false;
  export let outlet = PortOutlet;
  export let hideName = false;
  export let showOnHeader = false;

  let portEl;
  let connectionCount = 0;

  $: isConnected = connected || connectionCount > 0;

  const { chip, side } = getChipWithSide(INPUT, OUTPUT);
  const port = {
    type: 'port',
    chip,
    side,
    name,
    dataType: type,
    get eventDetails() {
      return {
        chip: chip.id,
        side,
        name,
      };
    },
    get portConnected() {
      return isConnected;
    },
    get outletElement() {
      return portEl.firstChild;
    },
    get connectionCount() {
      return connectionCount;
    },
    set connectionCount(value) {
      connectionCount = value;
    },
  };

  $: port.name = name;
  $: port.dataType = type;

  onMount(() => {
    portEl.$promaPort = port;
    portEl.remove();
    chip.addPort(side, portEl, showOnHeader);
    return () => {
      chip.removePort(side, portEl);
      portEl.style.display = 'none';
      document.body.appendChild(portEl);
    };
  });
</script>

<div
  class="Port Port-{name} Port-type-{type} {side}"
  bind:this={portEl}
  on:click
>
  {#if outlet}
    <div class="PortOutlet">
      <svelte:component this={outlet} {type} connected={isConnected} />
    </div>
  {/if}
  {#if !hideName}
    <div class="PortLabel">{name}</div>
  {/if}
  {#if $$slots.default}
    <div class="PortInput">
      <slot />
    </div>
  {/if}
</div>

<style>
  .Port {
    display: flex;
    align-items: center;
    padding: 5px;
    border: 1px solid transparent;
    border-radius: 3px;
    background-color: transparent;

    cursor: default;

    transition-property: border-color, background-color;
    transition-duration: var(--proma-board-transition-duration, 0.25s);
    transition-timing-function: var(
      --proma-board-transition-timing-function,
      ease
    );
  }

  .Port:hover {
    background-color: var(
      --proma-board--port-hover--background-color,
      transparent
    );
    border-color: var(--proma-board--port-hover--border-color, #444444);
  }

  .Port.input {
    flex-direction: row;
  }

  .Port.output {
    flex-direction: row-reverse;
  }

  .PortLabel {
    padding: 0 8px;
  }

  .PortInput {
    max-width: 150px;
  }

  .Port .PortOutlet {
    color: var(--proma-board--type-any, #00a7ef);
  }

  .Port-type-exec .PortOutlet {
    color: var(--proma-board--type-exec, #e7e7e7);
  }

  .Port-type-string .PortOutlet {
    color: var(--proma-board--type-string, #55d67c);
  }

  .Port-type-number .PortOutlet {
    color: var(--proma-board--type-number, #57acee);
  }

  .Port-type-boolean .PortOutlet {
    color: var(--proma-board--type-boolean, #eeac57);
  }

  .Port-type-object .PortOutlet {
    color: var(--proma-board--type-object, #ac57ee);
  }

  .Port-type-array .PortOutlet {
    color: var(--proma-board--type-array, #bf7df2);
  }

  .Port-type-tuple .PortOutlet {
    color: var(--proma-board--type-tuple, #cd82a3);
  }

  .Port-type-function .PortOutlet {
    color: var(--proma-board--type-function, #d6557c);
  }
</style>
