# Proma Codebase Analysis

Analysis of the Proma visual programming language codebase — architecture observations, UI issues, and project-wide suggestions.

> **proma-core issues**: See [`docs/proma-core-architecture-smells.md`](./proma-core-architecture-smells.md) for the full analysis of `@proma/core` architecture smells, test gaps, and improvement backlog.

## Summary

Proma is a sophisticated visual programming language with a well-designed core model (chips, ports, wires, compilation). The codebase shows strong foundational thinking but has accumulated technical debt in certain areas. The core engine has good test coverage; the UI layer is lighter on tests but benefits from Storybook.

---

## Issues Found

### UI / svelte-components

#### 1. Wire initialization uses a retry loop

- **Location**: `packages/proma-svelte-components/src/board/Wire.svelte`
- `Wire.svelte` retries up to 8 times on mount to find port outlet elements.
- Indicates a timing issue between chip rendering and wire registration.
- **Suggestion**: Use a port registration callback or event rather than polling. The board could maintain a `portReady` promise map.

---

## Test Coverage Gaps

| Area | Status | Gap |
|------|--------|-----|
| proma-core | See smells doc | — |
| proma-svelte-components | Storybook only | No unit tests for Board, Chip, Wire interaction |
| proma-web | 2 spec files | Missing tests for file management, project export, editor switching |

**Suggestion**: Add integration tests for the UI layer using Playwright — test chip creation, wire connection, and compilation round-trip in the browser.

---

## Project-Wide Suggestions

### High Priority

1. **Add CI/CD** — No GitHub Actions workflows exist. At minimum, add:
   - `pnpm install && pnpm check && pnpm test` on PR
   - `pnpm build` to catch build regressions
   - Consider Storybook visual regression testing

2. **Integration tests for the visual editor** — Use Playwright to test the full loop: create chip → connect wires → compile → verify output. This protects against UI/core integration regressions.

### Medium Priority

3. **Improve error reporting** — Compilation and deserialization errors are minimal. Add structured error types with source location info (chip ID, port name, wire endpoints).

4. **Extract standard library into a separate package** — `core/library/` could become `@proma/stdlib` to allow community extensions and reduce core size.

### Nice to Have

5. **Type-safe event system** — The shortcut dispatcher in `shortcuts.js` uses string-based event matching. A typed event map would catch mismatches at compile time.

6. **Storybook coverage for all board components** — Currently partial. Full stories for Wire, Port, and Board interactions would serve as living documentation.

7. **Documentation for the `.proma` file format** — The JSON structure is undocumented beyond code. A spec would help third-party tool developers.

---

## Architecture Observations

### What works well

- **Chip/port/wire model** is clean and expressive. The four-port-type system (InputFlow, OutputFlow, InputData, OutputData) elegantly captures both data flow and execution flow.
- **Edit API with undo/redo** is well-designed. History tracking uses deep diffs and grouping.
- **Svelte 5 runes** in the UI layer provide clean reactivity without a separate state management library.
- **CSS custom property theming** makes the editor highly customizable.
- **Separation of concerns** between core (no DOM dependency), components (reusable Svelte), and web app (SvelteKit) is solid.

### What could be improved

- **Core is JavaScript with JSDoc** — migrating critical modules to TypeScript would catch issues earlier. The type declaration generation (`build:types`) is already in place.
- **No linting in proma-core** — Only the Svelte packages have ESLint configured.
- **Vendor bundling** (recast, fast-deep-equal) makes updates harder. Consider using npm dependencies directly if bundle size permits.
- **The web app has significant UI logic in `+page.svelte`** (~500 lines) — extracting project management, file handling, and editor state into dedicated modules would improve maintainability.

---

## File Size Reference

Large files that may benefit from splitting:

| File | ~Lines | Concern |
|------|--------|---------|
| `core/compile-port-compilers.mjs` | ~520 | Port compiler factories (split from compile.mjs in PR #53) |
| `core/compile.mjs` | ~220 | Orchestration only (split in PR #53) |
| `core/compile-helpers.mjs` | ~120 | Graph/scope helpers |
| `core/edit.mjs` | 800+ | Mixed concerns (editing, validation, events) |
| `core/ports.mjs` | 600+ | Port classes + metadata + runtime |
| `core/types.mjs` | 600+ | Parser + matcher + checker |
| `Board.svelte` | 857 | Canvas + selection + wire creation + pan/zoom |
| `ChipBoardView.svelte` | 553 | Data model bridge + event handling |

---

*Last updated: February 2026.*
