<script>
  import { onMount } from 'svelte';
  import GroupList from '$lib/components/GroupList.svelte';
  import { registry } from '@proma/core';

  let searchInputEl;
  let searchValue;

  onMount(() => {
    searchInputEl.focus();
  });

  let registryMap;
  let registryGroupList;
  {
    registryMap = {};
    for (const chip of registry.list()) {
      const URI = chip.URI.split('/');
      const path = URI.slice(0, URI.length - 1);
      const name = URI[URI.length - 1];
      const entry = {
        path,
        label: chip.label,
        description: chip.metadata?.description,
        chip,
      };
      let cursor = registryMap;
      for (const part of path) {
        if (!cursor[part]) {
          cursor[part] = {
            $group: part,
          };
        }
        cursor = cursor[part];
      }
      cursor[name] = entry;
    }

    const wordsRegExp = /[A-Z][^A-Z\d]+|\d+|[A-Z]+(?![a-z])/g;
    function camelCaseToTitle(str) {
      str = str[0].toUpperCase() + str.slice(1);
      const words = [];
      let wordMatch;
      while ((wordMatch = wordsRegExp.exec(str))) {
        words.push(wordMatch[0].replace(/_/g, '').trim());
      }
      return words.filter((x) => !!x).join(' ');
    }

    function sortedKeys(obj) {
      return Array.from(Object.keys(obj))
        .sort((a, b) => a - b)
        .filter((k) => !k.startsWith('$'));
    }

    function itemsFromEntry(entries, key) {
      const entry = entries[key];
      if (entry.$group === key) {
        return [
          { groupStart: key, text: camelCaseToTitle(key) },
          ...sortedKeys(entry).map((k) => itemsFromEntry(entry, k)),
        ];
      }
      return { ...entry, text: key };
    }

    registryGroupList = sortedKeys(registryMap)
      .map((k) => itemsFromEntry(registryMap, k))
      .flat(1);
    // TODO better select root of registry list
    registryGroupList.shift();
  }

  $: console.log(registryGroupList);
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
  <div class="result-list">
    <GroupList items={registryGroupList}>
      <button
        class="library-path"
        type="button"
        slot="groupStart"
        let:item
        let:toggle
        let:collapsed
        on:click={toggle}
      >
        <span>{item.text}</span>
        <svg
          class="indicator"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="transform: rotate({collapsed ? '0' : '180deg'})"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </GroupList>
  </div>
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

  .result-list {
    position: relative;
    overflow-y: auto;
    max-height: 300px;
  }

  .library-path {
    display: block;
    position: relative;
    border: none;
    background: transparent;
    color: #6f6f70;
    text-align: left;
    font-size: 1em;
    padding: 10px;
    width: 100%;
    outline: none;
  }

  .library-path .indicator {
    position: absolute;
    right: 10px;
    top: 10px;
    cursor: pointer;
  }
</style>
