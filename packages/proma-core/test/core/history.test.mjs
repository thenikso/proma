import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  edit,
} from '../../core/index.mjs';

import { Pass } from '../lib.mjs';

// Helper to create a simple editable chip with basic ports
function makeEditChip(name = 'HistoryTestChip') {
  return edit(chip(name));
}

function makeEditChipWithPorts(name = 'HistoryTestChip') {
  return edit(
    chip(name, () => {
      const exec = inputFlow('exec');
      const value = inputData('value');
      const then = outputFlow('then');
      const out = outputData('out');
    }),
  );
}

describe('[core/history] canUndo/canRedo state', async (assert) => {
  assert({
    given: 'a fresh history',
    should: 'have canUndo=false and canRedo=false',
    actual: (() => {
      const editor = makeEditChip();
      return { canUndo: editor.canUndo, canRedo: editor.canRedo };
    })(),
    expected: { canUndo: false, canRedo: false },
  });

  assert({
    given: 'after adding a chip',
    should: 'have canUndo=true and canRedo=false',
    actual: (() => {
      const editor = makeEditChip();
      editor.addChip(new Pass('test'));
      return { canUndo: editor.canUndo, canRedo: editor.canRedo };
    })(),
    expected: { canUndo: true, canRedo: false },
  });

  assert({
    given: 'after adding a chip and undoing',
    should: 'have canUndo=false and canRedo=true',
    actual: (() => {
      const editor = makeEditChip();
      editor.addChip(new Pass('test'));
      editor.undo();
      return { canUndo: editor.canUndo, canRedo: editor.canRedo };
    })(),
    expected: { canUndo: false, canRedo: true },
  });

  assert({
    given: 'after adding a chip, undoing, and redoing',
    should: 'have canUndo=true and canRedo=false',
    actual: (() => {
      const editor = makeEditChip();
      editor.addChip(new Pass('test'));
      editor.undo();
      editor.redo();
      return { canUndo: editor.canUndo, canRedo: editor.canRedo };
    })(),
    expected: { canUndo: true, canRedo: false },
  });
});

describe('[core/history] undoCount/redoCount state', async (assert) => {
  assert({
    given: 'after adding two chips',
    should: 'have undoCount=2 and redoCount=0',
    actual: (() => {
      const editor = makeEditChip();
      editor.addChip(new Pass('a'));
      editor.addChip(new Pass('b'));
      return {
        undoCount: editor.history.undoCount,
        redoCount: editor.history.redoCount,
      };
    })(),
    expected: { undoCount: 2, redoCount: 0 },
  });

  assert({
    given: 'after adding two chips and undoing one',
    should: 'have undoCount=1 and redoCount=1',
    actual: (() => {
      const editor = makeEditChip();
      editor.addChip(new Pass('a'));
      editor.addChip(new Pass('b'));
      editor.undo();
      return {
        undoCount: editor.history.undoCount,
        redoCount: editor.history.redoCount,
      };
    })(),
    expected: { undoCount: 1, redoCount: 1 },
  });
});

describe('[core/history] undo/redo of addChip/removeChip', async (assert) => {
  assert({
    given: 'a chip is added then undone',
    should: 'remove the chip from the editor',
    actual: (() => {
      const editor = makeEditChip();
      editor.addChip(new Pass('p'), 'myChip');
      editor.undo();
      return editor.allChips().length;
    })(),
    expected: 0,
  });

  assert({
    given: 'a chip is added, undone, then redone',
    should: 're-add the chip to the editor',
    actual: (() => {
      const editor = makeEditChip();
      editor.addChip(new Pass('p'), 'myChip');
      editor.undo();
      editor.redo();
      return editor.allChips().length;
    })(),
    expected: 1,
  });

  assert({
    given: 'a chip is removed then undone',
    should: 'restore the chip',
    actual: (() => {
      const editor = makeEditChip();
      const chipInstance = new Pass('p');
      editor.addChip(chipInstance, 'myChip');
      editor.removeChip(chipInstance);
      editor.undo();
      return editor.allChips().length;
    })(),
    expected: 1,
  });

  assert({
    given: 'a chip is removed then undone and redone',
    should: 'remove the chip again',
    actual: (() => {
      const editor = makeEditChip();
      const chipInstance = new Pass('p');
      editor.addChip(chipInstance, 'myChip');
      editor.removeChip(chipInstance);
      editor.undo();
      editor.redo();
      return editor.allChips().length;
    })(),
    expected: 0,
  });
});

describe('[core/history] undo/redo of setChipId', async (assert) => {
  assert({
    given: 'a chip id is changed then undone',
    should: 'restore the old chip id',
    actual: (() => {
      const editor = makeEditChip();
      const chipInstance = new Pass('p');
      editor.addChip(chipInstance, 'originalId');
      editor.setChipId(chipInstance, 'newId');
      editor.undo();
      return chipInstance.id;
    })(),
    expected: 'originalId',
  });

  assert({
    given: 'a chip id is changed, undone, then redone',
    should: 'restore the new chip id',
    actual: (() => {
      const editor = makeEditChip();
      const chipInstance = new Pass('p');
      editor.addChip(chipInstance, 'originalId');
      editor.setChipId(chipInstance, 'newId');
      editor.undo();
      editor.redo();
      return chipInstance.id;
    })(),
    expected: 'newId',
  });
});

describe('[core/history] undo/redo of renameOutlet', async (assert) => {
  assert({
    given: 'an outlet is renamed then undone',
    should: 'restore the old outlet name',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      const chipInfo = editor.getPort('value');
      editor.renameOutlet('value', 'renamedValue');
      editor.undo();
      return editor.getPort('value') !== null;
    })(),
    expected: true,
  });

  assert({
    given: 'an outlet is renamed, undone, then redone',
    should: 'restore the new outlet name',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      editor.renameOutlet('value', 'renamedValue');
      editor.undo();
      editor.redo();
      return editor.getPort('renamedValue') !== null;
    })(),
    expected: true,
  });
});

describe('[core/history] undo/redo of moveOutlet', async (assert) => {
  assert({
    given: 'an outlet is moved then undone',
    should: 'restore the original order',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      editor.moveOutlet('in.value', 'in.exec');
      editor.undo();
      const inputs = editor.Chip.toJSON().in;
      return inputs.map((p) => p.name);
    })(),
    expected: ['exec', 'value'],
  });

  assert({
    given: 'an outlet is moved, undone, then redone',
    should: 'restore the moved order',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      editor.moveOutlet('in.value', 'in.exec');
      editor.undo();
      editor.redo();
      const inputs = editor.Chip.toJSON().in;
      return inputs.map((p) => p.name);
    })(),
    expected: ['value', 'exec'],
  });
});

describe('[core/history] undo/redo of addConnection/removeConnection', async (assert) => {
  assert({
    given: 'a connection is added then undone',
    should: 'remove the connection',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      editor.addConnection('exec', 'then');
      editor.undo();
      return editor.hasConnections(editor.getPort('exec'));
    })(),
    expected: false,
  });

  assert({
    given: 'a connection is added, undone, then redone',
    should: 'restore the connection',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      editor.addConnection('exec', 'then');
      editor.undo();
      editor.redo();
      return editor.hasConnections(editor.getPort('exec'));
    })(),
    expected: true,
  });
});

describe('[core/history] undo/redo of setPortValue', async (assert) => {
  assert({
    given: 'a port value is set then undone',
    should: 'restore the old value',
    actual: (() => {
      const editor = makeEditChip();
      const chipInstance = new Pass('p');
      editor.addChip(chipInstance, 'myChip');
      const port = chipInstance['in']['input'];
      editor.setPortValue(port, 'hello');
      editor.undo();
      return port.explicitValue;
    })(),
    expected: 'p',
  });

  assert({
    given: 'a port value is set, undone, then redone',
    should: 'restore the new value',
    actual: (() => {
      const editor = makeEditChip();
      const chipInstance = new Pass('p');
      editor.addChip(chipInstance, 'myChip');
      const port = chipInstance['in']['input'];
      editor.setPortValue(port, 'hello');
      editor.undo();
      editor.redo();
      return port.explicitValue;
    })(),
    expected: 'hello',
  });
});

describe('[core/history] redo stack clears on new operation', async (assert) => {
  assert({
    given: 'an undo is done and then a new operation is performed',
    should: 'clear the redo stack',
    actual: (() => {
      const editor = makeEditChip();
      editor.addChip(new Pass('a'));
      editor.addChip(new Pass('b'));
      editor.undo(); // undo second add - now redoCount=1
      editor.addChip(new Pass('c')); // new operation - should clear redo
      return editor.history.redoCount;
    })(),
    expected: 0,
  });
});

describe('[core/history] group operations', async (assert) => {
  assert({
    given: 'multiple operations grouped',
    should: 'undo them all at once',
    actual: (() => {
      const editor = makeEditChip();
      editor.history.beginGroup();
      editor.addChip(new Pass('a'));
      editor.addChip(new Pass('b'));
      editor.history.endGroup();
      editor.undo(); // should undo both adds
      return editor.allChips().length;
    })(),
    expected: 0,
  });

  assert({
    given: 'multiple operations grouped and undone then redone',
    should: 'redo them all at once',
    actual: (() => {
      const editor = makeEditChip();
      editor.history.beginGroup();
      editor.addChip(new Pass('a'));
      editor.addChip(new Pass('b'));
      editor.history.endGroup();
      editor.undo();
      editor.redo(); // should redo both adds
      return editor.allChips().length;
    })(),
    expected: 2,
  });

  assert({
    given: 'group operations count as one entry in undo stack',
    should: 'have undoCount=1 after one group',
    actual: (() => {
      const editor = makeEditChip();
      editor.history.beginGroup();
      editor.addChip(new Pass('a'));
      editor.addChip(new Pass('b'));
      editor.history.endGroup();
      return editor.history.undoCount;
    })(),
    expected: 1,
  });
});

describe('[core/history] clear', async (assert) => {
  assert({
    given: 'history is cleared after operations',
    should: 'have empty undo and redo stacks',
    actual: (() => {
      const editor = makeEditChip();
      editor.addChip(new Pass('a'));
      editor.addChip(new Pass('b'));
      editor.undo();
      editor.history.clear();
      return {
        undoCount: editor.history.undoCount,
        redoCount: editor.history.redoCount,
      };
    })(),
    expected: { undoCount: 0, redoCount: 0 },
  });
});

describe('[core/history] undo/redo of add*Outlet (fix redo bug)', async (assert) => {
  assert({
    given: 'an input flow outlet is added, undone, then redone',
    should: 're-add the outlet',
    actual: (() => {
      const editor = makeEditChip();
      editor.addInputFlowOutlet('myFlow');
      editor.undo();
      editor.redo();
      return editor.Chip.toJSON().in.some((p) => p.name === 'myFlow');
    })(),
    expected: true,
  });

  assert({
    given: 'an input data outlet is added, undone, then redone',
    should: 're-add the outlet',
    actual: (() => {
      const editor = makeEditChip();
      editor.addInputDataOutlet('myData');
      editor.undo();
      editor.redo();
      return editor.Chip.toJSON().in.some((p) => p.name === 'myData');
    })(),
    expected: true,
  });

  assert({
    given: 'an output flow outlet is added, undone, then redone',
    should: 're-add the outlet',
    actual: (() => {
      const editor = makeEditChip();
      editor.addOutputFlowOutlet('myOut');
      editor.undo();
      editor.redo();
      return editor.Chip.toJSON().out.some((p) => p.name === 'myOut');
    })(),
    expected: true,
  });

  assert({
    given: 'an output data outlet is added, undone, then redone',
    should: 're-add the outlet',
    actual: (() => {
      const editor = makeEditChip();
      editor.addOutputDataOutlet('myOutData');
      editor.undo();
      editor.redo();
      return editor.Chip.toJSON().out.some((p) => p.name === 'myOutData');
    })(),
    expected: true,
  });
});

describe('[core/history] undo/redo of removeOutlet', async (assert) => {
  assert({
    given: 'an outlet is removed then undone',
    should: 'restore the outlet at the same index',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      editor.removeInputOutlet('value');
      editor.undo();
      const inputs = editor.Chip.toJSON().in;
      return inputs.map((p) => p.name);
    })(),
    expected: ['exec', 'value'],
  });

  assert({
    given: 'an outlet is removed, undone, then redone',
    should: 'remove the outlet again',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      editor.removeInputOutlet('value');
      editor.undo();
      editor.redo();
      const inputs = editor.Chip.toJSON().in;
      return inputs.map((p) => p.name);
    })(),
    expected: ['exec'],
  });

  assert({
    given: 'an output outlet is removed then undone',
    should: 'restore the outlet',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      editor.removeOutputOutlet('out');
      editor.undo();
      const outputs = editor.Chip.toJSON().out;
      return outputs.map((p) => p.name);
    })(),
    expected: ['then', 'out'],
  });
});

describe('[core/history] undo/redo of setChipLabel', async (assert) => {
  assert({
    given: 'a chip label is set then undone',
    should: 'restore the original label',
    actual: (() => {
      const editor = makeEditChip();
      const chipInstance = new Pass('p');
      editor.addChip(chipInstance, 'myChip');
      const originalLabel = chipInstance.label;
      editor.setChipLabel(chipInstance, 'My Label');
      editor.undo();
      return chipInstance.label === originalLabel;
    })(),
    expected: true,
  });

  assert({
    given: 'a chip label is set, undone, then redone',
    should: 'restore the new label',
    actual: (() => {
      const editor = makeEditChip();
      const chipInstance = new Pass('p');
      editor.addChip(chipInstance, 'myChip');
      editor.setChipLabel(chipInstance, 'My Label');
      editor.undo();
      editor.redo();
      return chipInstance.label;
    })(),
    expected: 'My Label',
  });
});

describe('[core/history] undo/redo of setOutletType', async (assert) => {
  assert({
    given: 'an outlet type is set then undone',
    should: 'restore no type',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      const outlet = editor.getPort('value');
      const originalType = outlet.type;
      editor.setOutletType(outlet, 'Number');
      editor.undo();
      return outlet.type === originalType;
    })(),
    expected: true,
  });

  assert({
    given: 'an outlet type is set, undone, then redone',
    should: 'restore the new type',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      const outlet = editor.getPort('value');
      editor.setOutletType(outlet, 'Number');
      editor.undo();
      editor.redo();
      return editor.getPort('value').type?.signature;
    })(),
    expected: 'Number',
  });
});

describe('[core/history] undo/redo of removeChip with connections', async (assert) => {
  assert({
    given: 'a chip with connections is removed then undone',
    should: 'restore the chip and its connections',
    actual: (() => {
      const editor = makeEditChipWithPorts();
      const chipInstance = new Pass('p');
      editor.addChip(chipInstance, 'inner');
      // Connect the outlet to the chip port
      editor.addConnection('exec', chipInstance['in']['exec']);
      editor.removeChip(chipInstance);
      editor.undo();
      return {
        chipCount: editor.allChips().length,
        hasConn: editor.hasConnections(editor.getPort('exec')),
      };
    })(),
    expected: { chipCount: 1, hasConn: true },
  });
});
