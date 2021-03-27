<script>
  // TODO use compiled library
  import * as proma from '@proma/core';
  import { ChipBoardView } from '@proma/svelte-components';

  export let source;
  export let getEditedSource = undefined;

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

  $: if (chipEditor) {
    getEditedSource = function getSource() {
      return JSON.stringify(chipEditor.Chip.toJSON());
    };
  }
</script>

<ChipBoardView chip={sourceChip} edit={chipEditor} />
