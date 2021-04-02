<script>
  import { routes as routesStore, page } from './stores/routing';

  export let routes = [];

  $: $routesStore = routes;
</script>

{#if $page}
  {#if $page.layout}
    <svelte:component this={$page.layout}>
      <svelte:component this={$page.component} />
    </svelte:component>
  {:else}
    <svelte:component this={$page.component} />
  {/if}
{:else}
  <div>Invalid route</div>
{/if}
