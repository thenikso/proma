<script>
  import * as proma from '@proma/core';
  import { ChipBoardView } from '@proma/svelte-components';

  export let source;

  //
  // Data
  //

  let expectedSource;
  if (expectedSource !== source) {
    expectedSource = source;
  }

  $: sourceJson = expectedSource && JSON.parse(expectedSource);
  $: sourceChip =
    sourceJson &&
    proma.fromJSON(proma.chip, sourceJson, (errors) => {
      console.error(errors);
    });
  $: chipEditor = sourceChip && proma.edit(sourceChip);
</script>

<ChipBoardView
  chip={sourceChip}
  edit={chipEditor}
/>
