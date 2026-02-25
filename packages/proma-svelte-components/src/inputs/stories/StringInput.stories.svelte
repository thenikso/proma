<script>
	import { Meta, Template, Story } from '@storybook/addon-svelte-csf';
	import Theme from '../../stories/LightThemeDecorator.svelte';

	import StringInput from '../StringInput.svelte';
</script>

<Meta title="Input/StringInput" component={StringInput} />

<Template let:args>
	<StringInput {...args} />
</Template>

<Story name="Placeholder" args={{ placeholder: 'Placeholder text' }} />

<Story name="Themed" let:args args={{ placeholder: 'Placeholder text' }}>
	<Theme>
		<StringInput {...args} />
	</Theme>
</Story>
