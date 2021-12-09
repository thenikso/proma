<script>
  import { JsonInput, StringInput, PortOutlet } from '@proma/svelte-components';

  export let chip;

  let instance = null;
  let instanceInputs = {};
  let instanceOutputs = {};
  let outputLogs = [];
  let outputErrors = [];

  $: inputDatas = chip.inputOutlets.filter((i) => !i.isFlow);
  $: inputFlows = chip.inputOutlets.filter((i) => i.isFlow);

  $: outputDatas = chip.outputOutlets.filter((i) => !i.isFlow);

  // Reset instance on chip class change
  $: if (chip) {
    instance = null;
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
    }
    return instance;
  }

  function runFlow(flowName) {
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
  <div class="Inputs">
    {#each inputDatas as inputData}
      <div class="PromaRunEditor-input">
        <div class="PromaRunEditor-input-name">
          <PortOutlet type={inputData.type.definitionKinds[0]} />
          {inputData.name}
        </div>
        <div class="PromaRunEditor-input-value">
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
      <div class="PromaRunEditor-input">
        <button
          type="button"
          class="PromaRunEditor-input-flow"
          on:click={() => runFlow(inputFlow.name)}
        >
          Run "{inputFlow.name}"
        </button>
      </div>
    {/each}
  </div>
  <div class="Outputs">
    {#each outputDatas as outputData}
      <div class="PromaRunEditor-output">
        <div class="PromaRunEditor-output-name">
          {outputData.name}
        </div>
        <div class="PromaRunEditor-output-value">
          {instanceOutputs[outputData.name] || 'undefined'}
        </div>
      </div>
    {/each}
  </div>
  {#if outputLogs.length > 0}
    <div class="Logs">
      {outputLogs}
    </div>
  {/if}
  {#if outputErrors.length > 0}
    <div class="Errors">
      {outputErrors}
    </div>
  {/if}
</div>

<style>
  .Logs {
    padding: 0.5rem;
    font-family: monospace;
    color: #d8dee4;
    background-color: #252629;
    border-radius: 4px;
  }
</style>