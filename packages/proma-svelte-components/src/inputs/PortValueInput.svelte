<script>
  import { onDestroy } from 'svelte';
  import StringInput from './StringInput.svelte';
  import JsonInput from './JsonInput.svelte';

  export let edit;
  export let port;

  let portValue = port.explicitValue;
  let portType = port.type && port.type.definitionKind;

  const handlePortValueChange = ({ detail }) => {
    if (detail.port === port) {
      portValue = port.explicitValue;
    }
  };

  let oldEdit;

  $: if (edit !== oldEdit) {
    if (oldEdit) {
      oldEdit.off('port:value', handlePortValueChange, true);
    }
    oldEdit = edit;
    edit.on('port:value', handlePortValueChange, true);
  }

  onDestroy(() => {
    if (oldEdit) {
      edit.off('port:value', handlePortValueChange, true);
    }
  });

  function handleInput({ detail }) {
    edit.setPortValue(port, detail.value);
  }
</script>

<div
  on:mousedown|stopPropagation
  on:keydown|stopPropagation
  on:keyup|stopPropagation
>
  {#if portType === 'string'}
    <StringInput
      placeholder={port.defaultValue || ''}
      value={portValue}
      on:input={handleInput}
    />
	{:else if portType === 'number'}
		<StringInput
			placeholder={port.defaultValue !== undefined ? String(port.defaultValue) : ''}
			value={portValue !== undefined ? String(portValue) : ''}
			on:input={handleInput}
		/>
  {:else}
    <JsonInput
      placeholder={port.defaultValue || 'undefined'}
      value={portValue}
      on:input={handleInput}
    />
  {/if}
</div>
