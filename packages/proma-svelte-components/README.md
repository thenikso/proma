# proma-svelte-components

Reusable Svelte components for building visual node editors with Proma.

## Overview

`proma-svelte-components` provides a complete set of UI components for creating visual programming editors:

- **Board** - Main node-based editor with pan/zoom, drag-and-drop, and wire drawing
- **Chip/Port/Wire** - Visual elements for displaying chip graphs
- **Views** - Complete editing interfaces for chips and projects
- **Input Controls** - Type-aware input components
- **Utilities** - Keyboard shortcuts, context management, and more

## Installation

```bash
npm install @proma/svelte-components
# or
pnpm add @proma/svelte-components
```

Note: This package has peer dependencies on `@proma/core` and `svelte`.

## Quick Start

### Basic Board Component

```svelte
<script>
	import { Board } from '@proma/svelte-components';
	import { chip, inputFlow, outputFlow } from '@proma/core';

	// Create a simple chip
	const MyChip = chip('MyChip', () => {
		const exec = inputFlow('exec', () => then());
		const then = outputFlow('then');
	});

	// Get the ChipInfo for the board
	const chipInstance = MyChip();
	const chipBoard = chipInstance.$info;

	// Track selected chips
	let selectedChips = [];
</script>

<div style="width: 100%; height: 600px;">
	<Board
		{chipBoard}
		bind:selectedChips
		on:wire:end={(e) => console.log('Wire connected!', e.detail)}
	/>
</div>
```

### Complete Editing View

```svelte
<script>
	import { ChipBoardView } from '@proma/svelte-components';
	import { fromJSON, registry } from '@proma/core';

	// Load chip from JSON
	let chipClass;
	let chipInstance;

	async function loadChip(json) {
		chipClass = await fromJSON(json);
		chipInstance = new chipClass();
	}

	// Use the registry for available chips
	registry.use('proma/std');
</script>

<ChipBoardView
	{chipInstance}
	{registry}
	on:change={(e) => console.log('Chip modified', e.detail)}
/>
```

## Components

### Board

The main visual editor component with full node-editing capabilities.

**Props:**

- `chipBoard` (ChipInfo) - The chip graph to display
- `panX` (number) - Horizontal pan offset (default: 0)
- `panY` (number) - Vertical pan offset (default: 0)
- `zoom` (number) - Zoom level (default: 1)
- `selectedChips` (array) - Currently selected chip IDs (bindable)
- `refreshKey` (any) - Change to force refresh

**Events:**

- `wire:start` - User starts drawing a wire
- `wire:probe` - Wire dragged over a port
- `wire:end` - Wire connection attempt
- `board:contextmenu` - Right-click on board
- `chip:contextmenu` - Right-click on chip
- `port:contextmenu` - Right-click on port

**Features:**

- **Pan/Zoom** - Mouse wheel, trackpad gestures, spacebar to grab
- **Selection** - Click to select, rectangle selection, multi-select with Cmd/Ctrl
- **Drag and Drop** - Move chips around the board
- **Wire Drawing** - Click port to start, drag to target, click to connect
- **Grid Snapping** - Chips snap to grid when moving
- **Type Coloring** - Wires colored by data type

**Example:**

```svelte
<script>
	import { Board } from '@proma/svelte-components';

	let chipBoard;
	let selectedChips = [];
	let panX = 0;
	let panY = 0;
	let zoom = 1;

	function handleWireEnd(event) {
		const { from, to } = event.detail;
		// Handle wire connection
	}
</script>

<Board {chipBoard} bind:selectedChips bind:panX bind:panY bind:zoom on:wire:end={handleWireEnd} />
```

### Chip

Displays an individual chip on the board.

**Props:**

- `chip` (object) - Chip instance
- `chipInfo` (ChipInfo) - Chip metadata
- `selected` (boolean) - Selection state
- `position` (object) - `{ x, y }` position

**Events:**

- `select` - Chip selected
- `contextmenu` - Right-click on chip

### Port

Displays a port on a chip.

**Props:**

- `port` (Port) - Port instance
- `type` (string) - 'input' or 'output'
- `flow` (boolean) - Is this a flow port?

**Events:**

- `click` - Port clicked
- `contextmenu` - Right-click on port

### Wire / WirePath

Displays a connection between ports.

**Props:**

- `wire` (object) - Wire data with `from` and `to` port references
- `color` (string) - Wire color (based on type)

### ChipBoardView

Complete editing view with board, registry panel, and controls.

**Props:**

- `chipInstance` (Chip) - The chip being edited
- `registry` (Registry) - Registry for available chips
- `testPayload` (object) - Test data for running the chip

**Events:**

- `change` - Chip modified
- `run` - Chip executed with test data

**Features:**

- Chip board with full editing
- Registry browser to add chips
- Test/run functionality
- Chip details panel

### ChipOutletsDetailsView

Edit chip input/output ports.

**Props:**

- `chipInfo` (ChipInfo) - The chip to edit

**Features:**

- Add/remove input ports
- Add/remove output ports
- Rename ports
- Change port types
- Reorder ports

### SubChipDetailsView

Edit properties of a sub-chip within a chip graph.

**Props:**

- `subChip` (Chip) - The sub-chip instance
- `subChipInfo` (ChipInfo) - Sub-chip metadata

**Features:**

- Edit position
- Edit metadata
- View chip structure

### Input Components

Type-aware input controls for port values.

#### PortValueInput

Auto-selects the correct input component based on port type.

**Props:**

- `port` (Port) - The port to edit
- `value` (any) - Current value (bindable)

#### StringInput

Text input for strings.

**Props:**

- `value` (string) - Current value (bindable)
- `placeholder` (string) - Placeholder text

#### JsonInput

JSON editor with syntax highlighting.

**Props:**

- `value` (any) - Current value as JSON (bindable)
- `editable` (boolean) - Allow editing

### UI Components

#### Overlay

Modal/popup overlay for dialogs.

**Props:**

- `visible` (boolean) - Show/hide overlay
- `closeOnClickOutside` (boolean) - Close when clicking backdrop

**Slots:**

- Default slot - Overlay content

**Example:**

```svelte
<script>
	import { Overlay } from '@proma/svelte-components';
	let showDialog = false;
</script>

<button on:click={() => (showDialog = true)}>Open</button>

<Overlay visible={showDialog} closeOnClickOutside on:close={() => (showDialog = false)}>
	<div class="dialog">
		<h2>Dialog Content</h2>
		<button on:click={() => (showDialog = false)}>Close</button>
	</div>
</Overlay>
```

#### AddPortButton

Button for adding new ports to chips.

**Props:**

- `type` (string) - Port type ('input' or 'output')
- `portType` (string) - Data type for the port

**Events:**

- `click` - Button clicked

## Board Context API

The Board component provides a context API for child components:

```javascript
import { getBoardContext } from '@proma/svelte-components/board/context';

const board = getBoardContext();

// Methods:
board.selectChip(chip, event)           // Select a chip
board.deselectChip(chip)                // Deselect a chip
board.addWire(...)                      // Add a wire
board.removeWire(id)                    // Remove a wire
board.updateWires(limitChip)            // Update wire positions
board.startNewWire(port)                // Start drawing wire
board.endNewWire(port, event)           // Complete wire
board.probeNewWire(target, event)       // Check wire target
```

## Keyboard Shortcuts

The package includes a powerful keyboard shortcut system:

```javascript
import { shortcuts } from '@proma/svelte-components';

// Register a shortcut
shortcuts.register({
	pattern: 'Cmd+S',
	handler: (event) => {
		event.preventDefault();
		saveProject();
	},
	scope: 'editor', // Optional scope
});

// Remove a shortcut
shortcuts.unregister(handlerFunction);
```

**Pattern Syntax:**

- `Cmd+S` - Command (Mac) or Ctrl (Windows/Linux) + S
- `Shift+Enter` - Shift + Enter
- `Alt+ArrowUp` - Alt + Up Arrow
- Multiple modifiers: `Cmd+Shift+P`

## Styling

`@proma/svelte-components` stays CSS-variable driven so it can be themed by any host app.
The library does not require Tailwind or shadcn, but it can consume the same design tokens.

### Core theming variables

Board and chip visuals:

```css
:root {
	--proma-board-font-family: Inter, sans-serif;

	--proma-board--canvas--color: #111827;
	--proma-board--canvas--background-color: #ffffff;
	--proma-board--canvas--grid-minor-color: color-mix(in srgb, #d4d4d8 14%, transparent);
	--proma-board--canvas--grid-major-color: color-mix(in srgb, #d4d4d8 28%, transparent);

	--proma-board--chip--background-color: rgba(255, 255, 255, 0.85);
	--proma-board--chip--border-color: #d4d4d8;
	--proma-board--chip--color: #111827;
	--proma-board--chip-selected--gradient-from: #71717a;
	--proma-board--chip-selected--gradient-to: #18181b;

	--proma-board--type-any: #0ea5e9;
	--proma-board--type-string: #22c55e;
	--proma-board--type-number: #3b82f6;
	--proma-board--type-boolean: #f59e0b;
}
```

Input visuals (`StringInput`, `JsonInput`):

```css
:root {
	--proma-input--color: #111827;
	--proma-input--background: #f4f4f5;
	--proma-input--border-color: #d4d4d8;
	--proma-input--focus--background: #ffffff;
	--proma-input--focus--border-color: #71717a;
	--proma-input--error--border-color: #ef4444;
}
```

### Shadcn token bridge

If your app already defines shadcn variables, map Proma variables to them:

```css
:root {
	--proma-board--canvas--color: var(--foreground);
	--proma-board--canvas--background-color: var(--background);
	--proma-board--chip--background-color: color-mix(in srgb, var(--card) 85%, transparent);
	--proma-board--chip--border-color: var(--border);
	--proma-board--chip--color: var(--card-foreground);

	--proma-input--color: var(--foreground);
	--proma-input--background: var(--muted);
	--proma-input--border-color: var(--border);
	--proma-input--focus--background: var(--background);
	--proma-input--focus--border-color: var(--ring);
}
```

For dark mode, define the same variables under `.dark` (or your theme root) and switch classes in your host app.

## Development

### Building

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Watch for changes
pnpm dev
```

### Storybook

The package includes Storybook for component development:

```bash
# Start Storybook
pnpm storybook
```

This will start Storybook at http://localhost:6006 with interactive examples of all components.

### Project Structure

```
proma-svelte-components/
├── src/
│   ├── board/              # Board component and related
│   │   ├── Board.svelte    # Main board component
│   │   ├── Chip.svelte     # Chip display
│   │   ├── Port.svelte     # Port display
│   │   ├── Wire.svelte     # Wire display
│   │   ├── context.js      # Board context API
│   │   └── ...
│   ├── views/              # Complete editing views
│   │   ├── ChipBoardView.svelte
│   │   ├── ChipOutletsDetailsView.svelte
│   │   └── SubChipDetailsView.svelte
│   ├── inputs/             # Input controls
│   │   ├── PortValueInput.svelte
│   │   ├── StringInput.svelte
│   │   └── JsonInput.svelte
│   ├── ui/                 # UI utilities
│   │   ├── Overlay.svelte
│   │   └── AddPortButton.svelte
│   ├── shortcuts.js        # Keyboard shortcuts
│   └── index.js            # Main exports
├── dist/                   # Built files
├── .storybook/             # Storybook config
└── rollup.config.js        # Build config
```

## Examples

### Creating a Custom Editor

```svelte
<script>
	import { Board } from '@proma/svelte-components';
	import { chip, inputFlow, outputFlow, wire, registry } from '@proma/core';

	// Setup registry
	registry.use('proma/std');

	// Create a custom chip with sub-chips
	const MyFlow = chip('MyFlow', () => {
		const exec = inputFlow('exec', () => {
			log.exec();
		});

		// Add a Log chip
		const log = registry.get('proma/std#Log')();
		wire('Hello from custom editor!', log.message);
		wire(log.then, done);

		const done = outputFlow('done');
	});

	const chipInstance = MyFlow();
	const chipBoard = chipInstance.$info;

	let selectedChips = [];

	function handleChipContextMenu(event) {
		const { chip } = event.detail;
		console.log('Context menu for chip:', chip);
		// Show context menu
	}
</script>

<div class="editor">
	<div class="toolbar">
		<button on:click={() => chipInstance.exec()}>Run</button>
		<button on:click={() => (selectedChips = [])}>Clear Selection</button>
	</div>

	<div class="board-container">
		<Board {chipBoard} bind:selectedChips on:chip:contextmenu={handleChipContextMenu} />
	</div>
</div>

<style>
	.editor {
		width: 100%;
		height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.toolbar {
		padding: 10px;
		background: #2d2d2d;
		border-bottom: 1px solid #404040;
	}

	.board-container {
		flex: 1;
		position: relative;
	}
</style>
```

### Using with Edit API

```svelte
<script>
	import { Board } from '@proma/svelte-components';
	import { chip, edit, registry } from '@proma/core';

	const MyChip = chip('MyChip', () => {
		const exec = inputFlow('exec', () => then());
		const then = outputFlow('then');
	});

	const chipInstance = MyChip();
	const chipBoard = chipInstance.$info;
	const editor = edit(chipBoard);

	// Listen for changes
	editor.on('change', () => {
		console.log('Chip modified!');
		// Update the board
		chipBoard = chipBoard; // Trigger Svelte reactivity
	});

	function addLogChip() {
		const LogChip = registry.get('proma/std#Log');
		editor.addChip('log1', LogChip, {
			metadata: { x: 200, y: 100 },
		});
	}

	function handleWireEnd(event) {
		const { from, to } = event.detail;

		// Add connection via edit API
		editor.connect(from.chip.$info.id, from.port.name, to.chip.$info.id, to.port.name);
	}
</script>

<button on:click={addLogChip}>Add Log Chip</button>

<Board {chipBoard} on:wire:end={handleWireEnd} />
```

## TypeScript Support

The package includes TypeScript definitions. Import types from `@proma/core`:

```typescript
import type { ChipInfo, Port } from '@proma/core';
import { Board } from '@proma/svelte-components';

let chipBoard: ChipInfo;
let selectedChips: string[] = [];
```

## Contributing

1. Make changes in `src/` directory
2. Test in Storybook: `pnpm storybook`
3. Build: `pnpm build`
4. Ensure `pnpm lint` passes

## License

[Add license information]
