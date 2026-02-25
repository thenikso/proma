<script>
	import { createBubbler } from 'svelte/legacy';

	const bubble = createBubbler();
	import { onMount } from 'svelte';
	import { getChipWithSide, INPUT, OUTPUT } from './context';
	import PortOutlet from './PortOutlet.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {any} name
	 * @property {string} [type]
	 * @property {boolean} [connected]
	 * @property {any} [outlet]
	 * @property {boolean} [hideName]
	 * @property {boolean} [showOnHeader]
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let {
		name,
		type = 'any',
		connected = false,
		outlet = PortOutlet,
		hideName = false,
		showOnHeader = false,
		children,
	} = $props();

	let portEl = $state();
	let connectionCount = $state(0);

	let isConnected = $derived(connected || connectionCount > 0);

	const { chip, side } = getChipWithSide(INPUT, OUTPUT);
	const port = $state({
		type: 'port',
		chip,
		side,
		name: '',
		dataType: 'any',
		get eventDetails() {
			return {
				chip: chip.id,
				side,
				name,
			};
		},
		get portConnected() {
			return isConnected;
		},
		get outletElement() {
			return portEl.firstChild;
		},
		get connectionCount() {
			return connectionCount;
		},
		set connectionCount(value) {
			connectionCount = value;
		},
	});

	$effect(() => {
		port.name = name;
	});
	$effect(() => {
		port.dataType = type;
	});

	onMount(() => {
		const parentEl = portEl.parentElement;
		portEl.$promaPort = port;
		portEl.remove();
		chip.addPort(side, portEl, showOnHeader);
		return () => {
			chip.removePort(side, portEl);
			if (parentEl) {
				parentEl.appendChild(portEl);
			}
		};
	});
</script>

<div class="Port Port-{name} Port-type-{type} {side}" bind:this={portEl} onclick={bubble('click')}>
	{#if outlet}
		{@const SvelteComponent = outlet}
		<div class="PortOutlet">
			<SvelteComponent {type} connected={isConnected} />
		</div>
	{/if}
	{#if !hideName}
		<div class="PortLabel">{name}</div>
	{/if}
	{#if children}
		<div class="PortInput">
			{@render children?.()}
		</div>
	{/if}
</div>

<style>
	.Port {
		display: flex;
		align-items: center;
		padding: 5px;
		border: 1px solid transparent;
		border-radius: 3px;
		background-color: transparent;

		cursor: default;

		transition-property: border-color, background-color;
		transition-duration: var(--proma-board-transition-duration, 0.25s);
		transition-timing-function: var(--proma-board-transition-timing-function, ease);
	}

	.Port:hover {
		background-color: var(--proma-board--port-hover--background-color, transparent);
		border-color: var(--proma-board--port-hover--border-color, #444444);
	}

	.Port.input {
		flex-direction: row;
	}

	.Port.output {
		flex-direction: row-reverse;
	}

	.PortLabel {
		padding: 0 8px;
	}

	.PortInput {
		max-width: 150px;
		margin-top: -5px;
		margin-bottom: -5px;
	}

	.Port .PortOutlet {
		cursor: crosshair;
	}

	.Port .PortOutlet > :global(svg) {
		display: block;
	}
</style>
