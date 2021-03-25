<script>
  import { Meta, Template, Story } from '@storybook/addon-svelte-csf';
  import Chip from '../Chip.svelte';
  import Inputs from '../Inputs.svelte';
  import Outputs from '../Outputs.svelte';
  import Port from '../Port.svelte';

  const meta = {
  title: 'Board/Chip with ports',
  component: Chip,
  argTypes: {
    // label: { control: 'text' },
    // primary: { control: 'boolean' },
    // backgroundColor: { control: 'color' },
    // size: {
    //   control: { type: 'select', options: ['small', 'medium', 'large'] },
    // },
    // onClick: { action: 'onClick' },
  },
}
</script>

<Meta {...meta} />

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

<Story name="Empty" args={{}} />

<Story name="Selected" args={{ selected: true }} />
