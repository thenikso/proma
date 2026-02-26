<script>
	import { createEventDispatcher } from 'svelte';

	/**
	 * @typedef {Object} Props
	 * @property {string} [placeholder]
	 * @property {string} [value]
	 * @property {any} [validate]
	 */

	/** @type {Props & { [key: string]: any }} */
	let { placeholder = '', value = $bindable(''), validate = (v) => v, ...rest } = $props();

	//
	// Events
	//

	const dispatch = createEventDispatcher();

	function dispatchInput(details) {
		dispatch('input', details);
	}

	//
	// Implementation
	//

	let internalValue = $state();
	let error = $state();

	$effect(() => {
		internalValue = value;
		error = null;
	});

	$effect(() => {
		internalValue &&
			validate &&
			Promise.resolve()
				.then(() => validate(internalValue))
				.then(() => {
					error = null;
				})
				.catch((e) => {
					error = e;
				});
	});

	function confirmValue() {
		try {
			if (validate) {
				validate(internalValue);
			}
			if (internalValue !== value) {
				value = internalValue;
				dispatchInput({ value });
			}
		} catch (e) {
			error = e;
			internalValue = value;
		}
	}

	//
	// Handlers
	//

	function handleKeydown(event) {
		event.stopPropagation();
		switch (event.code) {
			case 'Enter':
				event.preventDefault();
				confirmValue();
				event.srcElement.blur();
				break;
			case 'Escape':
				event.preventDefault();
				internalValue = value;
				event.srcElement.blur();
		}
	}

	function handleBlur() {
		confirmValue();
	}

	function handleMouseDown(event) {
		event.stopPropagation();
	}
</script>

<div class="StringInput">
	<input
		type="text"
		bind:value={internalValue}
		{placeholder}
		onmousedown={handleMouseDown}
		onkeydown={handleKeydown}
		onblur={handleBlur}
		{...rest}
	/>
	{#if error}
		<div class="error">{error.message}</div>
	{/if}
</div>

<style>
	.StringInput {
		position: relative;
		color: var(--proma-input--color, var(--foreground, #111827));
		background-color: var(--proma-input--background, var(--muted, #f4f4f5));
		border: 1px solid var(--proma-input--border-color, var(--border, #d4d4d8));
		border-radius: 5px;
		padding: 4px 6px;
		font-family: var(
			--proma-input-font-family,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Oxygen-Sans,
			Ubuntu,
			Cantarell,
			'Helvetica Neue',
			sans-serif
		);

		transition-property: background-color, border-color, color;
		transition-duration: var(--proma-board-transition-duration, 0.25s);
		transition-timing-function: var(--proma-board-transition-timing-function, ease);
	}

	.StringInput:focus-within {
		background-color: var(--proma-input--focus--background, var(--background, #ffffff));
		border-color: var(--proma-input--focus--border-color, var(--ring, #71717a));
	}

	input {
		display: block;
		box-sizing: border-box;
		min-width: 80px;
		width: 100%;
		color: inherit;
		font-family: inherit;
		font-weight: inherit;
		font-size: inherit;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		outline: unset;
	}

	.error {
		position: absolute;
		background-color: color-mix(in srgb, var(--destructive, #ef4444) 10%, var(--background, #ffffff));
		color: var(--destructive, #b91c1c);
		padding: 2px 5px;
		border: 1px solid color-mix(in srgb, var(--destructive, #ef4444) 50%, transparent);
		border-radius: 4px;
		top: 1px;
		right: 1px;
		max-width: 30%;
		max-height: calc(100% - 2px);
		overflow: hidden;
		text-overflow: ellipsis;
		z-index: 1;

		transition-property: max-width, max-height;
		transition-duration: var(--proma-board-transition-duration, 0.25s);
		transition-timing-function: var(--proma-board-transition-timing-function, ease);
	}

	.error:hover {
		max-width: 100%;
		max-height: 300%;
		z-index: 10;
	}
</style>
