<script>
  import { StringInput } from '@proma/web-controls';

  export let edit;
  export let port;

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
    placeholder="value"
    value={port.explicitValue}
    on:input={handleInput}
  />
</div>
