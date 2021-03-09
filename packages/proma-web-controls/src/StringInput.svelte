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

  let internalValue;
  let error;
  let updatingValue = false;

  $: if (!updatingValue) {
    internalValue = value;
    error = null;
  } else {
    updatingValue = false;
  }

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
      const newValue = validate ? validate(internalValue) : internalValue;
      if (newValue !== value) {
        updatingValue = true;
        value = newValue;
        dispatchInput({ value });
      }
    } catch (e) {
      updatingValue = true;
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
        event.srcElement.blur();
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

<div class="NameInput" {...$$restProps}>
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

<style>
  input {
    min-width: 100px;
    width: 100%;
  }
</style>
