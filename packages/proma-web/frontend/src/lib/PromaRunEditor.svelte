<script>
  import { createEventDispatcher } from 'svelte';
  import { JsonInput, StringInput, PortOutlet } from '@proma/svelte-components';
  const dispatch = createEventDispatcher();

  export let chip;

  export let instance = undefined;
  let instanceInputs = {};
  let instanceOutputs = {};
  let outputLogs = [];
  let outputErrors = [];
  let selectedFlow;

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

  $: metadataTest = chip?.metadata?.tests?.[0];

  $: inputDatas = chip.inputOutlets.filter((i) => !i.isFlow);
  $: inputFlows = chip.inputOutlets.filter((i) => i.isFlow);
  $: outputDatas = chip.outputOutlets.filter((i) => !i.isFlow);

  // Reset instance on chip class change or flow reset
  $: if (chip) {
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
  }

  $: if (!selectedFlow) {
    instance = null;
  }

  $: dispatchTestChange(instanceInputs, selectedFlow);
  $: dispatchInstanceChange(instance);

  function setInput(name, value) {
    if (instance) {
      instance.in[name] = value;
    }
    instanceInputs = {
      ...instanceInputs,
      [name]: value,
    };
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
</script>

<div class="PromaRunEditor">
  {#if selectedFlow}
    <div class="Outputs">
      <div class="flow-input">
        <button
          type="button"
          class="back button outline"
          title="Change input values"
          on:click={() => (selectedFlow = '')}>◀</button
        >
        <button
          type="button"
          class="flow button"
          on:click={() => runFlow(selectedFlow)}
        >
          Re-run "{selectedFlow}"
        </button>
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
          <div class="label">
            <PortOutlet type={inputData.type.definitionKinds[0]} />
            <span class="name">{inputData.name}</span>
          </div>
          <div class="value">
            {#if inputData.type.definitionKinds[0] === 'string'}
              <StringInput
                placeholder={inputData.defaultValue || 'undefined'}
                value={instanceInputs[inputData.name]}
                on:input={(e) => setInput(inputData.name, e.detail.value)}
              />
            {:else}
              <JsonInput
                placeholder={inputData.defaultValue || 'undefined'}
                value={instanceInputs[inputData.name]}
                on:input={(e) => setInput(inputData.name, e.detail.value)}
              />
            {/if}
          </div>
        </div>
      {/each}

      {#each inputFlows as inputFlow}
        <div class="flow-input">
          <button
            type="button"
            class="flow button"
            on:click={() => runFlow(inputFlow.name)}
          >
            Run "{inputFlow.name}"
          </button>
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

  .flow-input > .flow.button {
    flex-grow: 1;
    text-align: left;
  }

  .flow-input > .back.button {
    margin-right: 8px;
    padding-right: 12px;
  }

  .output {
    margin: 8px 0;
  }

  .output > .value {
    padding: 0.5rem;
    font-family: monospace;
    border-radius: 4px;
    border: 1px solid #d8dee4;
  }

  .Logs {
    padding: 0.5rem;
    font-family: monospace;
    color: #d8dee4;
    background-color: #252629;
    border-radius: 4px;
  }
</style>
