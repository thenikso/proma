import { context, assert } from './utils.mjs';
import { Chip as ChipBase, ChipInfo } from './chip.mjs';
import { runIngressEvents } from './run.mjs';
import { EditableChipInfo } from './edit.mjs';
import { Compilation } from './compile.mjs';
import { deserializeChip } from './serialize.mjs';

export const OnCreateEvent = event('OnCreate');
export const OnDestroyEvent = event('OnDestroy');

export const chip = makeChipFactory(
  () => {
    const onCreate = new OnCreateEvent();
    const onDestroy = new OnDestroyEvent();
    return { onCreate, onDestroy };
  },
  {
    onCreate(chip) {
      runIngressEvents(chip, (i) => i instanceof OnCreateEvent);
    },
    onDestroy(chip) {
      runIngressEvents(chip, (i) => i instanceof OnDestroyEvent);
    },
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
    inline: 'once',
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

//
// Implementations
//

function makeChipFactory($buildIngressEvents, $ingressDrivers, $subclassChip) {
  function chip(uri, build) {
    if (typeof uri !== 'string') {
      build = uri;
      uri = undefined;
    }
    const chipInfo = new ChipInfo(uri);
    context.push(chipInfo);
    const ingressEvents =
      (typeof $buildIngressEvents === 'function' && $buildIngressEvents()) ||
      $buildIngressEvents ||
      {};
    if (typeof build === 'function') {
      build.call(undefined, ingressEvents);
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
        else if (
          $ingressDrivers &&
          typeof $ingressDrivers.onCreate === 'function'
        ) {
          $ingressDrivers.onCreate(this);
        }
      }

      destroy() {
        if (
          $ingressDrivers &&
          typeof $ingressDrivers.onDestroy === 'function'
        ) {
          $ingressDrivers.onDestroy(this);
        }
      }

      static get URI() {
        return chipInfo.URI;
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

    const ChipClass =
      typeof $subclassChip === 'function' ? $subclassChip(Chip) : Chip;

    if (typeof promaRegistry !== 'undefined') {
      promaRegistry.add(ChipClass);
    }

    return ChipClass;
  }
  chip.extend = function extendChip(
    buildIngressEvents,
    ingressDrivers,
    subclassChip,
  ) {
    return makeChipFactory(
      () =>
        Object.assign(
          {},
          (typeof $buildIngressEvents === 'function' &&
            $buildIngressEvents()) ||
            $buildIngressEvents,
          (typeof buildIngressEvents === 'function' && buildIngressEvents()) ||
            buildIngressEvents,
        ),
      Object.assign({}, $ingressDrivers, ingressDrivers),
      subclassChip
        ? $subclassChip
          ? (Klass) => subclassChip($subclassChip(Klass))
          : (Klass) => subclassChip(Klass)
        : undefined,
    );
  };
  chip.fromJSON = (data) => deserializeChip(chip, data);
  return chip;
}
