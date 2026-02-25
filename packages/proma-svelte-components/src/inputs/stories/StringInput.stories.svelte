<script>
	import { Meta, Template, Story } from '@storybook/addon-svelte-csf';
	import Theme from '../../stories/LightThemeDecorator.svelte';

	import StringInput from '../StringInput.svelte';
</script>

<Meta title="Input/StringInput" component={StringInput} />

<Template>
	{#snippet children({ args })}
		<StringInput {...args} />
	{/snippet}
</Template>

<Story name="Placeholder" args={{ placeholder: 'Placeholder text' }} />

<Story name="Themed" args={{ placeholder: 'Placeholder text' }}>
	{#snippet children({ args })}
		<Theme>
			<StringInput {...args} />
		</Theme>
	{/snippet}
</Story>
