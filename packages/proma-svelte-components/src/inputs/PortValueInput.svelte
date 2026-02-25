<script>
	import { onDestroy } from 'svelte';
	import StringInput from './StringInput.svelte';
	import JsonInput from './JsonInput.svelte';

	let { edit, port } = $props();

	let portValue = $state();
	let portType = $derived(port.type && port.type.definitionKind);

	const handlePortValueChange = ({ detail }) => {
		if (detail.port === port) {
			portValue = port.explicitValue;
		}
	};

	let oldEdit;

	$effect(() => {
		portValue = port.explicitValue;
	});

	$effect(() => {
		if (edit !== oldEdit) {
			if (oldEdit) {
				oldEdit.off('port:value', handlePortValueChange, true);
			}
			oldEdit = edit;
			edit.on('port:value', handlePortValueChange, true);
		}
	});

	onDestroy(() => {
		if (oldEdit) {
			oldEdit.off('port:value', handlePortValueChange, true);
		}
	});

	function handleInput({ detail }) {
		edit.setPortValue(port, detail.value);
	}
</script>

<div role="group">
	{#if portType === 'string'}
		<StringInput placeholder={port.defaultValue || ''} value={portValue} on:input={handleInput} />
	{:else if portType === 'number'}
		<StringInput
			placeholder={port.defaultValue !== undefined ? String(port.defaultValue) : ''}
			value={portValue !== undefined ? String(portValue) : ''}
			on:input={handleInput}
		/>
	{:else}
		<JsonInput
			placeholder={port.defaultValue || 'undefined'}
			value={portValue}
			on:input={handleInput}
		/>
	{/if}
</div>
