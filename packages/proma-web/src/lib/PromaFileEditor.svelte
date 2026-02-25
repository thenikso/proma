<script>
	import * as proma from '@proma/core';
	import eq from 'fast-deep-equal';
	import { untrack } from 'svelte';
	import { ChipBoardView, Overlay, createShortcutDispatcher } from '@proma/svelte-components';
	import PromaChipRegistry from './PromaChipRegistry.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {string} [id]
	 * @property {any} source
	 * @property {any} [instance]
	 * @property {import('svelte').Snippet<[any]>} [children]
	 */

	/** @type {Props} */
	let { id = 'PromaFile', source, instance = undefined, children } = $props();

	let sourceChip = $state();
	let chipEditor = $state();
	let selectedChips = $state([]);

	function getEventPath(event) {
		if (event?.composedPath) {
			return event.composedPath();
		}
		return event?.path || [];
	}

	async function updateChipEditor(sourceJson) {
		// TODO better check to see if soruce changed. maybe just check URI?
		if (!sourceJson || (chipEditor && eq(chipEditor.Chip.toJSON(), sourceJson))) {
			return;
		}
		proma
			.fromJSON(proma.chip, sourceJson, {
				withErrors: (errors) => {
					console.error(errors);
				},
			})
			.then((resChip) => {
				sourceChip = resChip;
				chipEditor = sourceChip && proma.edit(sourceChip);
			})
			.catch((err) => {
				console.error('here', err);
			});
	}

	export function getEditedSource() {
		return JSON.stringify(chipEditor.Chip.toJSON());
	}

	//
	// Shortcuts
	//

	const actionTarget = {
		getEditedSource,
	};

	let dispatchShortcut = $state(() => {});
	$effect(() => {
		dispatchShortcut = createShortcutDispatcher([
			{
				id,
				select: (e) => {
					return !!getEventPath(e).find((el) => el.id === id);
				},
				present: actionTarget,
			},
		]);
	});

	//
	// Sub-chip request
	//

	let newSubChipRequest = $state();

	function newEventChipFromType(functionType) {
		const ports = functionType.argumentsTypes.map((t, i) => ({
			name: t.label || `arg${i + 1}`,
			type: t.signature,
		}));
		const CustomEventChip = proma.event('CustomEvent', ...ports);
		return CustomEventChip;
	}

	//
	// Event handlers
	//

	function handleChipRequest(e) {
		newSubChipRequest = e.detail;
	}

	function handleSelectionChange(e) {
		selectedChips = e.detail.chips.slice();
	}
	//
	// Data
	//

	$effect(() => {
		if (!source) {
			return;
		}
		const sourceValue = source;
		untrack(() => {
			try {
				updateChipEditor(JSON.parse(sourceValue));
			} catch (err) {
				console.error('Unable to parse source JSON', err);
			}
		});
	});
	let subChipContextList = $derived(
		newSubChipRequest
			? [
					...(newSubChipRequest.fromType && newSubChipRequest.fromType.definitionKind === 'function'
						? [newEventChipFromType(newSubChipRequest.fromType)]
						: []),
					...Object.values(newSubChipRequest.chip.customChipClasses),
				]
			: [],
	);
</script>

{#if sourceChip}
	<div class="PromaFile" {id} onkeydown={dispatchShortcut}>
		<ChipBoardView
			chip={sourceChip}
			edit={chipEditor}
			{instance}
			on:subChip:request={handleChipRequest}
			on:selection:change={handleSelectionChange}
		/>

		{@render children?.({ chip: sourceChip, edit: chipEditor, actionTarget, selectedChips })}

		{#if newSubChipRequest}
			<Overlay
				anchor={{
					x: newSubChipRequest.clientX - 5,
					y: newSubChipRequest.clientY - 5,
				}}
				on:dismiss={() => (newSubChipRequest = null)}
			>
				<PromaChipRegistry
					registry={chipEditor.registry}
					contextChips={subChipContextList}
					on:close={() => (newSubChipRequest = null)}
					on:select={(e) => {
						const chipClass = e.detail.chip;
						newSubChipRequest.provideChipInstance(new chipClass());
						newSubChipRequest = null;
					}}
				/>
			</Overlay>
		{/if}
	</div>
{/if}

<style>
	.PromaFile {
		position: relative;
		height: 100%;
	}
</style>
