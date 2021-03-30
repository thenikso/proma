<script>
  // An array of objects that will be sent to a slot
  // - groups are objects with `{ groupStart: 'group id', noCollapse: false }`
  //   and will be sent to slot named "groupStart"
  // - groups can be ended (or they will extend till the next group or end
  //   of list) with a `{ groupEnd: 'group id' }` and will be sent to slot "groupEnd"
  // - other items will be sent to slot "item"
  // - if an item is an array it is treated as a nested GroupList
  export let items = [];

  const ROOT_GROUP = {
    get collapsed() {
      return false;
    },
  };

  $: itemsStatus = items.reduce(
    (temp, item, index) => {
      if (item.groupStart) {
        const group = (temp.currentGroup = {
          id: item.groupStart,
          collapsed: !item.noCollapse,
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
      temp.result.push({ item, group: temp.currentGroup });
      if (item.groupEnd) {
        temp.currentGroup = ROOT_GROUP;
      }
      return temp;
    },
    { result: [], currentGroup: ROOT_GROUP },
  ).result;
</script>

{#each itemsStatus as { item, group }}
  {#if item.groupStart}
    <slot
      name="groupStart"
      {item}
      toggle={() => (group.collapsed = !group.collapsed)}
      collapsed={group.collapsed}
    >
      <div
        on:click={() => (group.collapsed = !group.collapsed)}
        style="background: white; position: sticky; top: 0;"
      >
        <strong>{item.text}</strong>
      </div>
    </slot>
  {:else if !group.collapsed}
    {#if item.groupEnd}
      <slot name="groupEnd" {item} />
    {:else if Array.isArray(item)}
      <svelte:self items={item}>
        <svelte:fragment slot="groupStart" let:item let:toggle let:collapsed>
          <slot name="groupStart" {item} {toggle} {collapsed}>
            <div
              on:click={() => (group.collapsed = !group.collapsed)}
              style="background: white; position: sticky; top: 0;"
            >
              <strong>{item.text}</strong>
            </div>
          </slot>
        </svelte:fragment>
        <svelte:fragment slot="groupEnd" let:item>
          <slot name="groupEnd" {item} />
        </svelte:fragment>
        <svelte:fragment slot="item" let:item>
          <slot name="item" {item}>
            <div>{item.text}</div>
          </slot>
        </svelte:fragment>
      </svelte:self>
    {:else}
      <slot name="item" {item}>
        <div>{item.text}</div>
      </slot>
    {/if}
  {/if}
{/each}

