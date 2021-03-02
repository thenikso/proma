<script>
  import { NameInput } from '@proma/web-controls';

  export let title;
  export let outlets = [];
</script>

<section>
  <header>
    {title}
  </header>
  {#each outlets as outlet}
    <div>
      <NameInput value={outlet.name} placeholder="Port name" />
    </div>
  {/each}
</section>
