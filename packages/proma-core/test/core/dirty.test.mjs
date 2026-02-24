import { describe } from '../runner/riteway.mjs';
import {
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  wire,
  edit,
  trackDirty,
} from '../../core/index.mjs';
import { Pass } from '../lib.mjs';

describe('[core/dirty] initial state', async (assert) => {
  assert({
    given: 'a fresh DirtyTracker',
    should: 'have no dirty state',
    actual: (() => {
      const editor = edit(chip('DirtyTest'));
      const tracker = trackDirty(editor);
      return { hasDirty: tracker.hasDirty, needsFull: tracker.needsFullRecompile };
    })(),
    expected: { hasDirty: false, needsFull: false },
  });
});

describe('[core/dirty] chip operations', async (assert) => {
  assert({
    given: 'adding a chip',
    should: 'mark that chip as dirty',
    actual: (() => {
      const editor = edit(chip('DirtyTest'));
      const tracker = trackDirty(editor);
      editor.addChip(new Pass('test'), 'myChip');
      return { hasDirty: tracker.hasDirty, isDirty: tracker.isDirty('myChip') };
    })(),
    expected: { hasDirty: true, isDirty: true },
  });

  assert({
    given: 'removing a chip',
    should: 'mark full recompile',
    actual: (() => {
      const editor = edit(chip('DirtyTest'));
      editor.addChip(new Pass('test'), 'myChip');
      const tracker = trackDirty(editor);
      tracker.clear();
      editor.removeChip('myChip');
      return tracker.needsFullRecompile;
    })(),
    expected: true,
  });

  assert({
    given: 'renaming a chip id',
    should: 'track the new id as dirty',
    actual: (() => {
      const editor = edit(chip('DirtyTest'));
      editor.addChip(new Pass('test'), 'oldId');
      const tracker = trackDirty(editor);
      tracker.clear();
      editor.setChipId('oldId', 'newId');
      return { oldDirty: tracker.isDirty('oldId'), newDirty: tracker.isDirty('newId') };
    })(),
    expected: { oldDirty: false, newDirty: true },
  });
});

describe('[core/dirty] connection operations', async (assert) => {
  assert({
    given: 'adding a connection',
    should: 'mark connected chips dirty',
    actual: (() => {
      const editor = edit(chip('DirtyTest', () => {
        const exec = inputFlow('exec');
        const then = outputFlow('then');
      }));
      editor.addChip(new Pass('test'), 'Pass');
      const tracker = trackDirty(editor);
      tracker.clear();
      editor.addConnection('exec', 'Pass.in.exec');
      return tracker.isDirty('Pass');
    })(),
    expected: true,
  });
});

describe('[core/dirty] port value changes', async (assert) => {
  assert({
    given: 'setting a port value',
    should: 'mark the chip as dirty',
    actual: (() => {
      const editor = edit(chip('DirtyTest'));
      const chipInstance = new Pass('test');
      editor.addChip(chipInstance, 'Pass');
      const tracker = trackDirty(editor);
      tracker.clear();
      editor.setPortValue(chipInstance.in.input, 'new value');
      return tracker.isDirty('Pass');
    })(),
    expected: true,
  });
});

describe('[core/dirty] clear', async (assert) => {
  assert({
    given: 'clearing dirty state',
    should: 'reset everything',
    actual: (() => {
      const editor = edit(chip('DirtyTest'));
      editor.addChip(new Pass('test'), 'Pass');
      const tracker = trackDirty(editor);
      tracker.clear();
      return { hasDirty: tracker.hasDirty, chips: tracker.dirtyChips.size };
    })(),
    expected: { hasDirty: false, chips: 0 },
  });
});

describe('[core/dirty] outlet changes', async (assert) => {
  assert({
    given: 'adding an outlet',
    should: 'mark full recompile',
    actual: (() => {
      const editor = edit(chip('DirtyTest'));
      const tracker = trackDirty(editor);
      editor.addInputFlowOutlet('exec');
      return tracker.needsFullRecompile;
    })(),
    expected: true,
  });
});
