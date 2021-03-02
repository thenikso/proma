<script>
  import { createEventDispatcher } from 'svelte';

  export let placeholder = '';
  export let value = '';
  export let validate = (v) => v;

  //
  // Events
  //

  const dispatch = createEventDispatcher();

  function dispatchInput(details) {
    dispatch('input', details);
  }

  //
  // Implementation
  //

  let internalValue = value;
  let error = null;

  $: internalValue &&
    validate &&
    Promise.resolve()
      .then(() => validate(internalValue))
      .then(() => {
        error = null;
      })
      .catch((e) => {
        error = e;
      });

  function confirmValue() {
    try {
      value = validate ? validate(internalValue) : internalValue;
    } catch (e) {
      error = e;
      internalValue = value;
    }
  }

  //
  // Handlers
  //

  function handleKeydown(event) {
    switch (event.code) {
      case 'Enter':
        event.preventDefault();
        confirmValue();
        break;
      case 'Escape':
        event.preventDefault();
        internalValue = value;
        event.srcElement.blur();
    }
  }

  function handleBlur() {
    confirmValue();
  }
</script>

<div class="NameInput">
  <input
    type="text"
    bind:value={internalValue}
    {placeholder}
    on:keydown={handleKeydown}
    on:blur={handleBlur}
  />
  {#if error}
    <div class="error">{error.message}</div>
  {/if}
</div>
