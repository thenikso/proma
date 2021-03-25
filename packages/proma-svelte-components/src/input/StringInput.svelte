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

<div class="StringInput">
  <input
    type="text"
    bind:value={internalValue}
    {placeholder}
    on:keydown={handleKeydown}
    on:blur={handleBlur}
    {...$$restProps}
  />
  {#if error}
    <div class="error">{error.message}</div>
  {/if}
</div>

<style>
  .StringInput {
    color: var(--proma-controls--input--color, white);
    background-color: var(--proma-controls--input--background, #57575773);
    border: 1px solid var(--proma-controls--input--border-color, #383839);
    border-radius: 5px;
    padding: 4px 6px;
    font-family: var(
      --proma-input-font-family,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      Oxygen-Sans,
      Ubuntu,
      Cantarell,
      'Helvetica Neue',
      sans-serif
    );

    transition-property: background-color, border-color, color;
    transition-duration: var(--proma-board-transition-duration, 0.25s);
    transition-timing-function: var(
      --proma-board-transition-timing-function,
      ease
    );
  }

  .StringInput:focus-within {
    background-color: var(--proma-controls--input-focus--background, #575757);
    border-color: var(--proma-controls--input-focus--border-color, #257bfb);
  }

  input {
    display: block;
    box-sizing: border-box;
    min-width: 80px;
    width: 100%;
    color: inherit;
    font-family: inherit;
    font-weight: inherit;
    border: none;
    background: transparent;
    padding: 0;
    margin: 0;
    outline: unset;
  }
</style>
