import { context, assert, info } from './utils.mjs';
import { Chip as ChipBase, ChipInfo } from './chip.mjs';
import { runIngressEvents } from './run.mjs';
import { EditableChipInfo } from './edit.mjs';
import { Compilation } from './compile.mjs';
import { deserializeChip } from './serialize.mjs';
import { registry } from './registry.mjs';

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

function makeChipFactory($buildIngressEvents, $ingressDrivers) {
  function chip(uri, build, configuration) {
    if (typeof uri !== 'string') {
      build = uri;
      uri = undefined;
    }
    const config = Object.assign(
      {
        editable: true,
        metadata: undefined,
      },
      configuration,
    );
    const chipInfo = new ChipInfo(uri);
    context.push(chipInfo);
    const ingressEvents =
      (typeof $buildIngressEvents === 'function' &&
        $buildIngressEvents(config)) ||
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
      constructor(...canonicalValues) {
        super(chipInfo, canonicalValues);
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

      compile(wrapper) {
        const compilation = new Compilation(chipInfo, this);
        return compilation.compile(wrapper);
      }

      //
      // Static public API
      //

      static get URI() {
        return chipInfo.URI;
      }

      static compile(wrapper) {
        const compilation = new Compilation(chipInfo, null);
        return compilation.compile(wrapper);
      }

      static toJSON() {
        const chipData = chipInfo.toJSON();
        if (!this.editable) {
          chipData.editable = false;
        }
        if (this.metadata) {
          // TODO clone-deep
          chipData.metadata = this.metadata;
        }
        return chipData;
      }

      static get metadata() {
        return config.metadata;
      }

      static set metadata(value) {
        config.metadata = value;
      }

      static get editable() {
        return config.editable;
      }

      // TODO accept an optional new "build" function that can have deleteChip..?
      static edit() {
        if (!this.editable) {
          throw new Error('Chip is not editable');
        }
        return new EditableChipInfo(this, chipInfo);
      }

      static get isLoaded() {
        return chipInfo.isLoaded;
      }

      static get loaded() {
        return chipInfo.loaded;
      }

      static get inputOutlets() {
        return chipInfo.inputs.slice();
      }

      static get outputOutlets() {
        return chipInfo.outputs.slice();
      }

      static get chips() {
        return chipInfo.chips.slice();
      }

      static get inactiveIngressChips() {
        // TODO only if editable?
        return chipInfo.ingressEvents.filter(
          (ic) => !chipInfo.chips.includes(ic),
        );
      }

      static get connections() {
        return Array.from(chipInfo.sinkConnection.entries()).map(
          ([sinkPort, sourcePort]) => {
            let source = { chip: sourcePort.chip, port: sourcePort };
            let sink = { chip: sinkPort.chip, port: sinkPort };
            // If one of the ports is a flow outlet we need to invert the logic
            if (sinkPort.isFlow || (info(sinkPort) && info(sinkPort).isFlow)) {
              const tmp = source;
              source = sink;
              sink = tmp;
            }
            return {
              source,
              sink,
            };
          },
        );
      }
    }

    // TODO maybe not add automatically?
    registry.add(Chip);

    return Chip;
  }
  chip.extend = function extendChip(buildIngressEvents, ingressDrivers) {
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
    );
  };
  chip.fromJSON = (data) => {
    const ChipClass = deserializeChip(chip, data, data.editable !== false);
    ChipClass.metadata = data.metadata;
    return ChipClass;
  };
  return chip;
}
