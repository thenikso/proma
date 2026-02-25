<script>
  // An array of objects that will be sent to a slot
  // - groups are objects with `{ groupStart: 'group id', noCollapse: false }`
  //   and will be sent to slot named "groupStart"
  // - groups can be ended (or they will extend till the next group or end
  //   of list) with a `{ groupEnd: 'group id' }` and will be sent to slot "groupEnd"
  // - other items will be sent to slot "item"
  // - if an item is an array it is treated as a nested GroupList
  export let items = [];
  export let getItemOptions;

  const ROOT_GROUP = {
    get collapsed() {
      return false;
    },
  };

  $: itemsStatus = items.reduce(
    (temp, item, index) => {
      const options = getItemOptions?.(item) ?? item;
      if (options.groupStart) {
        const group = (temp.currentGroup = {
          id: options.groupStart,
          collapsed: !options.noCollapse,
          open() {
            group.collapsed = false;
          },
          close() {
            group.collapsed = true;
          },
          toggle() {
            group.collapsed = !group.collapsed;
          },
        });
      }
      temp.result.push({ options, item, group: temp.currentGroup });
      if (options.groupEnd) {
        temp.currentGroup = ROOT_GROUP;
      }
      return temp;
    },
    { result: [], currentGroup: ROOT_GROUP },
  ).result;
</script>

{#each itemsStatus as { item, options, group }}
  {#if options.groupStart}
    <slot
      name="groupStart"
      {item}
      {options}
      toggle={() => (group.collapsed = !group.collapsed)}
      collapsed={group.collapsed}
    >
      <div
        on:click={() => (group.collapsed = !group.collapsed)}
        style="background: white; position: sticky; top: 0;"
      >
        <strong>{options.text}</strong>
      </div>
    </slot>
  {:else if !group.collapsed}
    {#if options.groupEnd}
      <slot name="groupEnd" {item} {options} />
    {:else if Array.isArray(options)}
      <svelte:self items={options} {getItemOptions} />
    {:else}
      <slot name="item" {item} {options}>
        <div>{options.text}</div>
      </slot>
    {/if}
  {/if}
{/each}
