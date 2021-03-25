<script>
  import { Meta, Template, Story } from '@storybook/addon-svelte-csf';

  import StringInput from '../StringInput.svelte';
</script>

<Meta title="Input/StringInput" component={StringInput} />

<Template let:args>
  <StringInput {...args} />
</Template>

<Story name="Placeholder" args={{ placeholder: 'Placeholder text' }} />

