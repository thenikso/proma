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

	function formatOutput(value) {
		if (value instanceof Error) {
			return value.stack || value.message;
		}
		if (Array.isArray(value)) {
			return value.map((item) => formatOutput(item)).join(' ');
		}
		if (typeof value === 'object' && value !== null) {
			try {
				return JSON.stringify(value, null, 2);
			} catch {
				return String(value);
			}
		}
		return String(value);
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

<div>
	{#if selectedFlow}
		<div>
			<div class="flex">
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
				<div class="my-2">
					<div>
						<span class="text-sm font-medium">{outputData.name}</span>
					</div>
					<div class="rounded-md border border-border p-2 font-mono text-sm">
						{instanceOutputs[outputData.name] || 'undefined'}
					</div>
				</div>
			{/each}
		</div>
		{#if outputLogs.length > 0}
			<div
				class="rounded-md border border-border bg-card p-2 font-mono text-sm text-card-foreground"
			>
				{#each outputLogs as log}
					<div class="whitespace-pre-wrap">
						{formatOutput(log)}
					</div>
				{/each}
			</div>
		{/if}
		{#if outputErrors.length > 0}
			<div
				class="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive"
			>
				{#each outputErrors as outputError}
					<div class="font-mono text-xs whitespace-pre-wrap">
						{formatOutput(outputError)}
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<div>
			{#each inputDatas as inputData}
				<div class="my-2">
					<div class="mb-1 flex items-center text-sm font-medium">
						<PortOutlet type={inputData.type.definitionKinds[0]} />
						<span class="pl-2">{inputData.name}</span>
					</div>
					<div class="pl-5">
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
				<div class="flex">
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
