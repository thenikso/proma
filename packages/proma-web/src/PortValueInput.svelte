<script>
  import { StringInput } from '@proma/web-controls';

  export let edit;
  export let port;

  // TODO switch input based on port type

  function handleInput({ detail }) {
    edit.setPortValue(port, detail.value);
  }
</script>

<StringInput
  placeholder="value"
  value={port.explicitValue}
  on:input={handleInput}
/>
