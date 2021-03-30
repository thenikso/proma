<script>
  import { onMount } from 'svelte';
  import { registry } from '@proma/core';

  let searchInputEl;
  let searchValue;

  onMount(() => {
    searchInputEl.focus();
  });
</script>

<div class="PromaChipRegistry">
  <div class="search-bar">
    <svg
      class="search-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="11" cy="11" r="6" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input
      type="text"
      placeholder="Search"
      bind:this={searchInputEl}
      bind:value={searchValue}
    />
    {#if searchValue}
      <button
        type="button"
        class="search-clear-button"
        on:click={() => (searchValue = '')}
      >
        <svg
          class="clear-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#aaaaaa"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    {/if}
  </div>
  <div class="result-list">list</div>
</div>

<style>
  .PromaChipRegistry {
    border-radius: 4px;
    background-color: var(--proma-panel--background-color, #fbfdfe);
    box-shadow: 0 0 3px #c2c3c4;
    min-width: 400px;
    font-size: 16px;
  }

  .search-bar {
    position: relative;
    color: #aaaaaa;
    border-bottom: 1px solid #ececec;
  }

  .search-bar svg.search-icon {
    position: absolute;
    top: 3px;
    left: 2px;
    pointer-events: none;
  }

  .search-bar input {
    box-sizing: border-box;
    width: 100%;
    padding: 9px 30px 8px 30px;
    color: var(--proma-input--color, white);

    font-size: 1em;
    font-weight: 500;
    border: none;
    background: transparent;
    outline: none;
  }

  .search-clear-button {
    box-sizing: border-box;
    position: absolute;
    top: 3px;
    right: 3px;
    height: 30px;
    border: none;
    background: transparent;
    cursor: pointer;
    outline: none;
  }
</style>
