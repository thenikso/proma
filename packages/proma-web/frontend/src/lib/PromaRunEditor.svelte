<script>
  import { StringInput } from '@proma/svelte-components';

  export let chip;

  $: inputDatas = chip.inputOutlets.filter((i) => !i.isFlow);
  $: inputFlows = chip.inputOutlets.filter((i) => i.isFlow);

  $: outputDatas = chip.outputOutlets.filter((i) => !i.isFlow);

  let instanceOutputs = {};

  $: instance = new chip();
  $: if (instance) {
    const updateInstanceOutputs = () => {
      const res = {};
      for (const o of outputDatas) {
        const name = o.name;
        res[name] = instance.out[name]();
      }
      instanceOutputs = res;
    };

    for (const o of chip.outputOutlets) {
      if (o.isFlow) {
        instance.out[o.name](() => {
          updateInstanceOutputs();
        });
      }
    }

    // TODO input data should have a type and we use the proper
    instance.in.request = { query: { name: 'nic' }, method: 'GET' };
  }

  $: console.log(instanceOutputs);
</script>

<div class="PromaRunEditor">
  <div class="Inputs">
    {#each inputDatas as inputData}
      <div class="PromaRunEditor-input">
        <div class="PromaRunEditor-input-name">
          {inputData.name}
        </div>
        <div class="PromaRunEditor-input-value">
          <StringInput
            placeholder={inputData.defaultValue || 'undefined'}
            value={inputData.value}
            on:input={(e) => (inputData.value = e.detail.value)}
          />
        </div>
      </div>
    {/each}

    {#each inputFlows as inputFlow}
      <div class="PromaRunEditor-input">
        <button
          type="button"
          class="PromaRunEditor-input-flow"
          on:click={() => instance.in[inputFlow.name]()}
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
</div>
