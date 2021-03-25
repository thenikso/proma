<script>
  import { Meta, Template, Story } from '@storybook/addon-svelte-csf';

  import Chip from '../Chip.svelte';
  import Inputs from '../Inputs.svelte';
  import Outputs from '../Outputs.svelte';
  import Port from '../Port.svelte';
</script>

<Meta title="Board/Chip" component={Chip} />

<Template let:args>
  <Chip {...args}>
    <Inputs>
      <Port name="execute" type="exec" />
      <Port name="message" />
    </Inputs>
    <Outputs>
      <Port name="then" type="exec" />
      <Port name="value" />
    </Outputs>
  </Chip>
</Template>

<Story name="with Ports" args={{}} />

<Story name="Selected" args={{ selected: true }} />
