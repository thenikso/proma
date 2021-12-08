<script>
  import { createEventDispatcher } from 'svelte';
  import eq from 'fast-deep-equal';
  import Overlay from '../ui/Overlay.svelte';
  import CodeMirror from '../views/CodeMirror.svelte';

  export let placeholder = undefined;
  export let value = undefined;
  export let validate = (v) => v;

  //
  // Events
  //

  const dispatch = createEventDispatcher();

  function dispatchInput(details) {
    dispatch('input', details);
  }

  //
  // Value handling
  //

  $: placeholderString =
    typeof placeholder === 'string' ? placeholder : JSON.stringify(value);
  $: valueString =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  let internalStringValue;
  let error;
  let updatingValue = false;

  $: if (!updatingValue) {
    internalStringValue = valueString;
    error = null;
  } else {
    updatingValue = false;
  }

  $: internalStringValue &&
    Promise.resolve()
      .then(() => validateJson(internalStringValue))
      .then(() => {
        error = null;
      })
      .catch((e) => {
        error = e;
      });

  function validateJson(value) {
    let v;
    try {
      if (typeof value === 'string') {
        v = JSON.parse(value);
        if (typeof v === 'string') {
          v = value;
        }
      } else {
        v = value;
      }
    } catch (e) {
      throw new Error('Invalid JSON: ' + e.message);
    }
    if (validate) {
      v = validate(v);
    }
    return v;
  }

  function confirmValue() {
    try {
      if (codeEditor) {
        internalStringValue = codeEditor.getValue();
      }
      showEditor = false;
      const newValue = internalStringValue.trim()
        ? validateJson(internalStringValue)
        : undefined;
      if (!eq(newValue, value)) {
        updatingValue = true;
        value = newValue;
        dispatchInput({ value });
      }
    } catch (e) {
      updatingValue = true;
      internalStringValue = valueString;
      if (!valueString) {
        error = e;
      } else {
        error = null;
      }
    }
  }

  //
  // Editor
  //

  let showEditor = false;
  let codeEditor;

  let containerEl;
  let containerBoundingBox;

  function openEditor() {
    containerBoundingBox = containerEl.getBoundingClientRect();
    showEditor = true;
  }

  $: if (containerEl) {
    containerBoundingBox = containerEl.getBoundingClientRect();
  }

  $: editorStyles = containerBoundingBox
    ? `width: ${containerBoundingBox.width + 1}px;`
    : '';

  //
  // Handlers
  //

  function handleKeydown(event) {
    switch (event.code) {
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        if (codeEditor && (event.ctrlKey || event.metaKey)) {
          confirmValue();
        } else if (!showEditor) {
          openEditor();
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        showEditor = false;
        internalStringValue = valueString;
        event.srcElement.blur();
        break;
    }
  }

  //
  // Utils
  //

  function debounce(f, interval) {
    let timer = null;

    return (...args) => {
      clearTimeout(timer);
      return new Promise((resolve) => {
        timer = setTimeout(() => resolve(f(...args)), interval);
      });
    };
  }
</script>

<div
  bind:this={containerEl}
  class="JsonInput"
  class:error
  tabindex="0"
  on:keydown={handleKeydown}
  on:click={openEditor}
>
  <div class="value" class:placeholder={typeof valueString === 'undefined'}>
    {valueString || (error && error.message) || placeholderString}
  </div>
  {#if showEditor}
    <Overlay anchor={containerBoundingBox} on:dismiss={confirmValue}>
      <div
        class="editor"
        class:error
        style={editorStyles}
        on:keydown={handleKeydown}
      >
        <CodeMirror
          bind:this={codeEditor}
          options={{
            value: valueString,
            mode: 'json',
          }}
          on:ready={({ detail }) => {
            detail.editor.focus();
          }}
          on:change={debounce(() => {
            if (updatingValue || !codeEditor) return;
            internalStringValue = codeEditor.getValue();
          }, 500)}
        />
      </div>
    </Overlay>
  {/if}
</div>

<style>
  .JsonInput {
    position: relative;
    color: var(--proma-input--color, white);
    background-color: var(--proma-input--background, #57575773);
    border: 1px solid var(--proma-input--border-color, #383839);
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
    outline: none;
    cursor: pointer;

    transition-property: background-color, border-color, color;
    transition-duration: var(--proma-board-transition-duration, 0.25s);
    transition-timing-function: var(
      --proma-board-transition-timing-function,
      ease
    );
  }

  .JsonInput:focus {
    background-color: var(--proma-input--focus--background, #575757);
    border-color: var(--proma-input--focus--border-color, #257bfb);
  }

  .value {
    max-height: 2em;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    user-select: none;
  }

  .value.placeholder {
    color: #a9a9a9;
  }

  .editor {
    position: relative;
    top: -1px;
    left: -1px;
    min-width: 200px;
    min-height: 100px;
    height: 100px;
    overflow: hidden;

    border: 1px solid var(--proma-input--border-color, #383839);
    border-radius: 5px;
  }

  .editor.error,
  .JsonInput.error {
    border-color: var(--proma-input--error--border-color, #ff0000);
  }
</style>
