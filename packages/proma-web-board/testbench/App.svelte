<script>
  import { Board, Chip, Inputs, Outputs, Port, Wire } from '../src';
</script>

<Board
  on:wire:start={(e) => console.log(e)}
  on:wire:end={(e) => console.log('new wire', e)}
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
  <Wire
    outputChip="one"
    outputPort="value"
    inputChip="two"
    inputPort="message"
  />
  <Wire
    outputChip="one"
    outputPort="then"
    inputChip="two"
    inputPort="execute"
  />
</Board>
