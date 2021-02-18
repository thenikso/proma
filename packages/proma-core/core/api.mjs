import { context, assert } from './utils.mjs';
import { Chip as ChipBase, ChipInfo } from './chip.mjs';
import { runIngressEvents } from './run.mjs';
import { EditableChipInfo } from './edit.mjs';
import { Compilation } from './compile.mjs';

export const OnCreateEvent = event('OnCreate');

function makeChipFactory($buildEvents, $constructed) {
  function chip(uri, build) {
    if (typeof uri !== 'string') {
      build = uri;
      uri = undefined;
    }
    const chipInfo = new ChipInfo(uri);
    context.push(chipInfo);
    const events =
      (typeof $buildEvents === 'function' && $buildEvents()) ||
      $buildEvents ||
      {};
    if (typeof build === 'function') {
      build.call(undefined, events);
    }
    context.pop();
    // TODO validate chip:
    // - if input data but not flow it may not do what you expect
    // - if not using all input data in outputs/execs
    class Chip extends ChipBase {
      constructor(...configValues) {
        super(chipInfo, configValues);
        const parentChipInfo = context();
        // Add to current chip `build` execution
        if (parentChipInfo instanceof ChipInfo) {
          parentChipInfo.addChip(this);
        }
        // Run `constructed`
        else if (typeof $constructed === 'function') {
          $constructed(this);
        }
      }

      static toJSON() {
        return chipInfo.toJSON();
      }

      // TODO accept an optional new "build" function that can have deleteChip..?
      static edit() {
        return new EditableChipInfo(this, chipInfo);
      }

      static compile(wrapper) {
        const compilation = new Compilation(chipInfo, null);
        return compilation.compile(wrapper);
      }

      compile(wrapper) {
        const compilation = new Compilation(chipInfo, this);
        return compilation.compile(wrapper);
      }
    }

    return Chip;
  }
  chip.extend = function extendChip(buildEvents, constructed) {
    return makeChipFactory(
      () =>
        Object.assign(
          {},
          (typeof $buildEvents === 'function' && $buildEvents()) ||
            $buildEvents,
          (typeof buildEvents === 'function' && buildEvents()) || buildEvents,
        ),
      (chip) => {
        if (typeof $constructed === 'function') $constructed(chip);
        if (typeof constructed === 'function') constructed(chip);
      },
    );
  };
  return chip;
}

export const chip = makeChipFactory(
  () => {
    const onCreate = new OnCreateEvent();
    return { onCreate };
  },
  (chip) => {
    runIngressEvents(chip, (i) => i instanceof OnCreateEvent);
  },
);

export function inputFlow(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addInputFlowPort(name, config);
}

export function inputData(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addInputDataPort(name, config);
}

export function outputFlow(name) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addOutputFlowPort(name);
}

export function outputData(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addOutputDataPort(name, config);
}

export function wire(portA, portB) {
  const chipInfo = context(ChipInfo);
  chipInfo.addConnection(portA, portB);
}

export function inputConfig(name, defaultValue) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addInputDataPort(name, {
    canonical: true,
    conceiled: true,
    defaultValue,
  });
}

export function outputHandle(name, execHandle) {
  assert(
    typeof execHandle === 'function',
    'A handler should specify a function',
  );
  const compute = () => execHandle;
  compute.toString = () => '() => ' + String(execHandle);
  return outputData(name, {
    compute,
    allowSideEffects: true,
  });
}

export function event(name, ...ports) {
  const eventInfo = new ChipInfo(name);
  context.push(eventInfo);
  // TODO funciton with ports and toString
  const handle = outputHandle('handle', () => then());
  const then = outputFlow('then');
  // TODO ports
  context.pop();

  class EventChip extends ChipBase {
    constructor() {
      super(eventInfo);
      // Add to current chip `build` execution
      const parentChipInfo = context();
      if (parentChipInfo instanceof ChipInfo) {
        parentChipInfo.ingressEvents.push(this);
      }
    }

    get isEvent() {
      return true;
    }
  }

  return EventChip;
}
