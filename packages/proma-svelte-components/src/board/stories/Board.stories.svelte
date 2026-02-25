<script>
	import { Meta, Template, Story } from '@storybook/addon-svelte-csf';
	import Theme from '../../stories/LightThemeDecorator.svelte';

	import Board from '../Board.svelte';
	import Wire from '../Wire.svelte';
	import Chip from '../Chip.svelte';
	import Inputs from '../Inputs.svelte';
	import Outputs from '../Outputs.svelte';
	import Port from '../Port.svelte';

	function detail(f) {
		return (e) => f(e.detail);
	}
</script>

<Meta
	title="Board/Board"
	component={Board}
	argTypes={{
		'on:wire:start': { action: 'on:wire:start' },
		'on:wire:probe': { action: 'on:wire:probe' },
		'on:wire:end': { action: 'on:wire:end' },
		'on:board:contextmenu': { action: 'on:board:contextmenu' },
		'on:chip:contextmenu': { action: 'on:chip:contextmenu' },
		'on:port:contextmenu': { action: 'on:port:contextmenu' },
	}}
/>

<Template>
	{#snippet children({ args })}
		<Board
			{...args}
			on:wire:start={detail(args['on:wire:start'])}
			on:wire:probe={detail(args['on:wire:probe'])}
			on:wire:end={detail(args['on:wire:end'])}
			on:board:contextmenu={detail(args['on:board:contextmenu'])}
			on:chip:contextmenu={detail(args['on:chip:contextmenu'])}
			on:port:contextmenu={detail(args['on:port:contextmenu'])}
		>
			<Chip id="one">
				<Inputs>
					<Port name="execute" type="exec" />
					<Port name="message" />
				</Inputs>
				<Outputs>
					<Port name="then" type="exec" />
					<Port name="value" />
				</Outputs>
			</Chip>
			<Chip id="two" x={200} y={200}>
				<Inputs>
					<Port name="execute" type="exec" />
					<Port name="message" />
				</Inputs>
				<Outputs>
					<Port name="then" type="exec" />
				</Outputs>
			</Chip>
			<Wire outputChip="one" outputPort="value" inputChip="two" inputPort="message" />
			<Wire outputChip="one" outputPort="then" inputChip="two" inputPort="execute" />
		</Board>
	{/snippet}
</Template>

<Story name="Example" args={{}} />

<Story name="Themed">
	{#snippet children({ args })}
		<Theme>
			<Board
				{...args}
				on:wire:start={detail(args['on:wire:start'])}
				on:wire:probe={detail(args['on:wire:probe'])}
				on:wire:end={detail(args['on:wire:end'])}
				on:board:contextmenu={detail(args['on:board:contextmenu'])}
				on:chip:contextmenu={detail(args['on:chip:contextmenu'])}
				on:port:contextmenu={detail(args['on:port:contextmenu'])}
			>
				<Chip id="one">
					<Inputs>
						<Port name="execute" type="exec" />
						<Port name="message" />
					</Inputs>
					<Outputs>
						<Port name="then" type="exec" />
						<Port name="value" />
					</Outputs>
				</Chip>
				<Chip id="two" x={200} y={200}>
					<Inputs>
						<Port name="execute" type="exec" />
						<Port name="message" />
					</Inputs>
					<Outputs>
						<Port name="then" type="exec" />
					</Outputs>
				</Chip>
				<Wire outputChip="one" outputPort="value" inputChip="two" inputPort="message" />
				<Wire outputChip="one" outputPort="then" inputChip="two" inputPort="execute" />
			</Board>
		</Theme>
	{/snippet}
</Story>
