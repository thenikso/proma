<script>
	import { Meta, Template, Story } from '@storybook/addon-svelte-csf';
	import Theme from '../../stories/LightThemeDecorator.svelte';

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

<Story name="Example" args={{}} />

<Story name="Selected" args={{ selected: true }} />

<Story name="Themed" let:args>
	<Theme>
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
	</Theme>
</Story>
