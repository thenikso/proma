<script>
  import { onDestroy } from 'svelte';
  import { StringInput } from '@proma/web-controls';

  export let edit;
  export let port;

  let portValue = port.explicitValue;

  const handlePortValueChange = ({ detail }) => {
    if (detail.port === port) {
      portValue = port.explicitValue;
    }
  };

  $: {
    if (edit) {
      edit.off('port:value', handlePortValueChange, true);
    }
    edit.on('port:value', handlePortValueChange, true);
  }

  onDestroy(() => {
    edit.off('port:value', handlePortValueChange, true);
  });

  // TODO switch input based on port type

  function handleInput({ detail }) {
    edit.setPortValue(port, detail.value);
  }
</script>

<div
  on:mousedown|stopPropagation
  on:keydown|stopPropagation
  on:keyup|stopPropagation
>
  <StringInput
    placeholder={port.defaultValue || ''}
    value={portValue}
    on:input={handleInput}
  />
</div>
