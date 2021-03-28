<script>
  import { StringInput } from '@proma/svelte-components';

  export let runUrl;
  export let runPromise;
</script>

<section class="PromaRunView">
  <header class="navigation">
    <StringInput disabled value={runUrl} />
    <button
      type="button"
      on:click={() => {
        runPromise = null;
      }}>X</button
    >
  </header>
  {#if runPromise}
    {#await runPromise}
      <div>loading...</div>
    {:then res}
      <pre
        class="results">{JSON.stringify(res.result || res.error, null, 2)}</pre>
      {#if res.logs && res.logs.length > 0}
        <pre class="logs">
    {#each res.logs as l}
      {l}
    {/each}
  </pre>
      {/if}
    {:catch err}
      <div>{err.message}</div>
    {/await}
  {/if}
</section>

<style>
  .PromaRunView {
    display: flex;
    flex-direction: column;
  }

  .navigation {
    padding: 20px;
    border-bottom: 1px solid var(--proma-board--chip--border-color, #1d1d1d);

    display: grid;
    grid-template-columns: 1fr 30px;
    grid-template-rows: 1fr;
    grid-gap: 5px;
  }

  .results {
    flex-grow: 1;
    margin: 0;
    padding: 5px 3px;
    overflow: auto;
  }

  .logs {
    max-height: 40%;
    background-color: #171717;
    border-radius: 4px;
    color: white;
    padding: 5px 3px;
    margin: 0;
    min-height: 100px;
    overflow: auto;
  }
</style>
