<script>
	import { createEventDispatcher } from 'svelte';
	import { PortOutlet } from '@proma/svelte-components';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	const dispatch = createEventDispatcher();

	let { chip, instance = $bindable(undefined) } = $props();
	let instanceInputs = $state({});
	let instanceOutputs = $state({});
	let outputLogs = $state([]);
	let outputErrors = $state([]);
	let selectedFlow = $state();
	let inputDrafts = $state({});

	function dispatchTestChange(data, flow) {
		dispatch('testChange', {
			test: { data, flow },
		});
	}

	function dispatchInstanceChange(instance) {
		dispatch('instanceChange', {
			instance,
		});
	}

	function setInput(name, value) {
		if (instance) {
			instance.in[name] = value;
		}
		instanceInputs = {
			...instanceInputs,
			[name]: value,
		};
	}

	function getInputDraft(name) {
		if (Object.hasOwn(inputDrafts, name)) return inputDrafts[name];
		const value = instanceInputs[name];
		return typeof value === 'undefined' ? '' : JSON.stringify(value, null, 2);
	}

	function setJsonDraft(name, rawValue) {
		inputDrafts = { ...inputDrafts, [name]: rawValue };
		const raw = rawValue.trim();
		try {
			const parsed = raw ? JSON.parse(raw) : undefined;
			setInput(name, parsed);
		} catch {
			// Keep draft while JSON is being edited and invalid.
		}
	}

	function getInstance() {
		if (!instance) {
			// Get canonical input data values
			const canonicalInputData = inputDatas
				.filter((i) => i.isCanonical)
				.map((i) => instanceInputs[i.name]);
			// Create instance
			instance = new chip(...canonicalInputData);
			// Collect all output data
			const updateInstanceOutputs = () => {
				const res = {};
				for (const o of outputDatas) {
					const name = o.name;
					res[name] = instance.out[name]();
				}
				instanceOutputs = res;
			};
			// Connect all instance output flows
			for (const o of chip.outputOutlets) {
				if (o.isFlow) {
					instance.out[o.name](() => {
						updateInstanceOutputs();
					});
				}
			}
			// Set saved instance inputs
			for (const i of inputDatas) {
				if (typeof instanceInputs[i.name] !== 'undefined') {
					instance.in[i.name] = instanceInputs[i.name];
				}
			}
		}
		return instance;
	}

	function runFlow(flowName) {
		selectedFlow = flowName;
		const releaseConsole = captureConsole();
		Promise.resolve()
			.then(() => {
				const instance = getInstance();
				const flow = instance.in[flowName];
				if (flow) {
					return flow();
				}
			})
			.catch((err) => {
				return err;
			})
			.then((err) => {
				const { logs, errors } = releaseConsole();
				if (err) {
					console.error(err);
				}
				outputLogs = logs;
				outputErrors = [...errors, err];
			});
	}

	function captureConsole() {
		const consoleLog = console.log;
		const logs = [];
		console.log = (...args) => {
			logs.push(args);
			consoleLog(...args);
		};

		const consoleError = console.error;
		const errors = [];
		console.error = (...args) => {
			errors.push(args);
			consoleError(...args);
		};

		return function releaseConsole() {
			console.log = consoleLog;
			console.error = consoleError;
			return {
				logs,
				errors,
			};
		};
	}
	let metadataTest = $derived(chip?.metadata?.tests?.[0]);
	let inputDatas = $derived(chip.inputOutlets.filter((i) => !i.isFlow));
	let inputFlows = $derived(chip.inputOutlets.filter((i) => i.isFlow));
	let outputDatas = $derived(chip.outputOutlets.filter((i) => !i.isFlow));
	// Reset instance on chip class change or flow reset
	$effect(() => {
		if (chip) {
			if (metadataTest) {
				instanceInputs = { ...(metadataTest.data || {}) };
				if (metadataTest.flow) {
					runFlow(metadataTest.flow);
				}
			} else {
				instance = null;
				selectedFlow = '';
				instanceInputs = {};
			}
			instanceOutputs = {};
			outputLogs = [];
			outputErrors = [];
			inputDrafts = {};
		}
	});
	$effect(() => {
		if (!selectedFlow) {
			instance = null;
		}
	});
	$effect(() => {
		dispatchTestChange(instanceInputs, selectedFlow);
	});
	$effect(() => {
		dispatchInstanceChange(instance);
	});
</script>

<div class="PromaRunEditor">
	{#if selectedFlow}
		<div class="Outputs">
			<div class="flow-input">
				<Button
					type="button"
					variant="outline"
					size="icon"
					class="mr-2"
					disabled={false}
					title="Change input values"
					onclick={() => (selectedFlow = '')}
				>
					◀
				</Button>
				<Button
					type="button"
					class="w-full justify-start"
					disabled={false}
					onclick={() => runFlow(selectedFlow)}
				>
					Re-run "{selectedFlow}"
				</Button>
			</div>

			{#each outputDatas as outputData}
				<div class="output">
					<div class="label">
						<span class="name">{outputData.name}</span>
					</div>
					<div class="value">
						{instanceOutputs[outputData.name] || 'undefined'}
					</div>
				</div>
			{/each}
		</div>
		{#if outputLogs.length > 0}
			<div class="Logs">
				{#each outputLogs as log}
					<div class="log">
						{log}
					</div>
				{/each}
			</div>
		{/if}
		{#if outputErrors.length > 0}
			<div class="Errors">
				{outputErrors}
			</div>
		{/if}
	{:else}
		<div class="Inputs">
			{#each inputDatas as inputData}
				<div class="input">
					<div class="label text-sm font-medium">
						<PortOutlet type={inputData.type.definitionKinds[0]} />
						<span class="name">{inputData.name}</span>
					</div>
					<div class="value">
						{#if inputData.type.definitionKinds[0] === 'string'}
							<Input
								type="text"
								class=""
								placeholder={inputData.defaultValue || 'undefined'}
								value={instanceInputs[inputData.name] ?? ''}
								oninput={(e) => setInput(inputData.name, e.currentTarget.value)}
							/>
						{:else}
							<Textarea
								class=""
								rows="3"
								placeholder={inputData.defaultValue || 'undefined'}
								value={getInputDraft(inputData.name)}
								oninput={(e) => setJsonDraft(inputData.name, e.currentTarget.value)}
							/>
						{/if}
					</div>
				</div>
			{/each}

			{#each inputFlows as inputFlow}
				<div class="flow-input">
					<Button
						type="button"
						class="w-full justify-start"
						disabled={false}
						onclick={() => runFlow(inputFlow.name)}
					>
						Run "{inputFlow.name}"
					</Button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.input {
		margin: 8px 0;
	}

	.input > .label {
		display: flex;
		align-items: center;
		margin-bottom: 4px;
	}

	.input > .label > .name {
		display: block;
		padding-left: 8px;
	}

	.input > .value {
		padding-left: 20px;
	}

	.flow-input {
		display: flex;
	}

	.output {
		margin: 8px 0;
	}

	.output > .value {
		padding: 0.5rem;
		font-family: monospace;
		border-radius: 4px;
		border: 1px solid var(--border);
	}

	.Logs {
		padding: 0.5rem;
		font-family: monospace;
		color: var(--card-foreground);
		background-color: var(--card);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
</style>
