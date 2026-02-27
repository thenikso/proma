# Proma

Visual programming language inspired by Unreal Engine Blueprints that compiles to JavaScript. Programs are graphs of **chips** (computation units) connected by **wires** through typed **ports**.

## Project Structure

Monorepo (pnpm workspaces) with three packages:

| Package | Path | Purpose |
|---------|------|---------|
| `@proma/core` | `packages/proma-core/` | Compiler, runtime, type system, edit API, serialization |
| `@proma/svelte-components` | `packages/proma-svelte-components/` | Svelte 5 board/chip/wire editor components |
| `@proma/web` | `packages/proma-web/` | SvelteKit playground app (static site) |

## Commands

```bash
pnpm install              # Setup
pnpm dev                  # Web playground (port 5173)
pnpm build                # Build all packages
pnpm check                # Type check all
pnpm test                 # Test all
pnpm format               # Prettier
```

Per-package commands work from each `packages/*/` directory. The core package uses `node test/index.mjs` (custom Riteway runner). UI packages use Vitest + Playwright.

Storybook (component dev): `cd packages/proma-svelte-components && pnpm storybook` (port 6006)

**Build order**: When changing `proma-core`, run `pnpm build` in that package before changes are visible in `proma-web`.

## Core Concepts

- **Chip**: Reusable computation unit with typed input/output ports. Defined via `chip()` factory.
- **Port**: Typed connector on a chip. Four kinds: InputFlow, OutputFlow, InputData, OutputData.
- **Wire**: Directed connection between two ports (source → sink).
- **Data flow**: Pure/functional — values propagate through connected data ports.
- **Execution flow**: Imperative sequencing via `exec`/`then` flow ports.
- **ChipInfo**: Graph metadata (ports, sub-chips, wires). Blueprint for chip instances.

## Compilation Pipeline

`ChipInfo` graph → port compilers → AST (via recast) → `ClassWrapper` → JavaScript class string.

Key files: `core/compile.mjs` (main pipeline), `core/compile-utils.mjs` (AST utilities), `core/wrappers/ClassWrapper.mjs` (class generation).

## Key Source Files (proma-core)

| File | Role |
|------|------|
| `core/api.mjs` | Public DSL: `chip()`, `inputFlow()`, `outputData()`, `wire()` |
| `core/chip.mjs` | Chip/ChipInfo classes, port management |
| `core/ports.mjs` | Port classes (extend Function), PortInfo metadata |
| `core/types.mjs` | Type signature parser, matching, runtime checking |
| `core/compile.mjs` | Compilation pipeline (~1k lines, monolithic) |
| `core/run.mjs` | Runtime port execution, scope management |
| `core/edit.mjs` | Live graph editing API with undo/redo |
| `core/serialize.mjs` / `deserialize.mjs` | JSON `.proma` format |
| `core/registry.mjs` | Chip URI resolution and lazy loading |
| `core/validate.mjs` | Structural validation (cycles, dangling flows) |
| `core/history.mjs` | Undo/redo history stack |
| `core/variadic.mjs` | Variadic port support |
| `core/library/` | Standard library: `std/`, `web/`, `node/` |

## UI Architecture (proma-svelte-components)

Svelte 5 with runes. Key components:

- `Board.svelte` — Canvas with pan/zoom, chip selection, wire creation
- `Chip.svelte` — Visual node rendering with ports
- `Port.svelte` / `PortOutlet.svelte` — Connector points
- `Wire.svelte` / `WirePath.svelte` — SVG Bezier curves, type-colored
- `ChipBoardView.svelte` — Bridge between proma-core data model and visual board

Source structure: `src/board/`, `src/inputs/`, `src/ui/`, `src/views/`, plus `actions.js` (board actions), `shortcuts.js` (keyboard bindings).

Styling: Tailwind CSS 4 + CSS custom properties for theming. Component library: bits-ui.

## Tech Stack

- **Language**: JavaScript (ES modules) + JSDoc/TypeScript declarations
- **UI**: Svelte 5, SvelteKit 2, Tailwind CSS 4
- **Bundling**: Rollup (core), Vite (UI/web)
- **AST**: Recast (vendored) for code generation
- **Testing**: Custom Riteway (core), Vitest + Playwright (UI)
- **Storybook**: 10.x for component development (`packages/proma-svelte-components`)
