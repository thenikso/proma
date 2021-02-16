<script>
  import { onMount } from 'svelte';
  import { getChipWithSide, INPUT, OUTPUT } from './lib/context';
  import PortOutlet from './PortOutlet.svelte';

  export let name;
  export let type = 'any';
  export let connected = false;
  export let outlet = PortOutlet;
  export let color = undefined;

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
    color,
    portConnected: connected,
    get outletElement() {
      return portEl.firstChild;
    },
    get connectionCount() {
      return connectionCount;
    },
    set connectionCount(value) {
      connectionCount = value;
    },
    // Handlers
    mouseDown(e) {
      if (e.button === 0) {
        chip.board.startNewWire(port);
      }
    },
    mouseUp(e) {
      if (chip.board.endNewWire(port, e)) {
        e.stopPropagation();
      }
    },
    drag(e) {
      e.stopPropagation();
    },
    contextmenu(e) {
      console.log('context menu');
    },
  };

  $: port.name = name;
  $: port.dataType = type;
  $: port.color = color;

  onMount(() => {
    portEl.$promaPort = port;
    portEl.remove();
    chip.addPort(side, portEl);
    return () => {
      chip.removePort(side, portEl);
      portEl.style.display = 'none';
      document.body.appendChild(portEl);
    };
  });
</script>

<div class="Port Port-{name} {side}" bind:this={portEl} on:click>
  {#if outlet}
    <svelte:component this={outlet} {type} {color} connected={isConnected} />
  {/if}
  <div class="PortLabel">{name}</div>
</div>

<style>
  .Port {
    display: flex;
    align-items: center;
    padding: 5px;
    border: 1px solid transparent;
    border-radius: 3px;
    transition: border-color 0.25s ease;

    cursor: default;
  }

  .Port:hover {
    border-color: #444444;
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
</style>
