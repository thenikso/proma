<script>
  import { edit as editChip } from '@proma/core/core/index.mjs';
  import { StringInput } from '@proma/web-controls';

  export let chip;
  export let subChipId;

  let stableChip;
  let edit;
  let subChip;

  $: if (chip !== stableChip) {
    stableChip = chip;
    edit = editChip(stableChip);
  }

  $: subChip = edit.getChip(subChipId);
</script>

<div class="Chip-Id">
  <label for="Chip-Id-input">Id</label>
  <StringInput
    id="Chip-Id-input"
    value={subChip.id}
    validate={(value) => {
      edit.setChipId(subChip, value, true);
      return value;
    }}
    on:input={(e) => edit.setChipId(subChip, e.detail.value)}
  />
</div>
