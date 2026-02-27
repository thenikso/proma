# Proma Codebase Analysis

Analysis of the Proma visual programming language codebase — issues found, suggestions for improvement, and observations.

## Summary

Proma is a sophisticated visual programming language with a well-designed core model (chips, ports, wires, compilation). The codebase shows strong foundational thinking but has accumulated technical debt in certain areas. The core engine has good test coverage; the UI layer is lighter on tests but benefits from Storybook.

---

## Issues Found

### Critical

#### 1. `compile.mjs` is a monolith with high regression risk
- ~1k lines mixing graph traversal, scope resolution, AST generation, compiler caching, and wrapper adaptation
- Nested compiler factories share mutable state and implicit invariants
- Small edits can cause hard-to-trace regressions
- **Suggestion**: Extract into phases — `compile-traverse.mjs`, `compile-scope.mjs`, `compile-codegen.mjs` — with clear interfaces between them

#### 2. Ports extend Function — fragile and hard to type
- `class Port extends Function` with runtime properties via `Object.defineProperties`
- TypeScript/JSDoc can't model the actual runtime shape, forcing `any` casts
- Breakage risk when adding accessors (already hit with `explicitValue`)
- **Suggestion**: Replace with a plain object wrapping a callable. A `port.call()` method or `Proxy` with `apply` trap would preserve the calling convention while being type-safe

#### 3. Global mutable context stack
- `context(...)` in `api.mjs` and `run.mjs` is ambient mutable state
- APIs appear pure but depend on hidden context
- Reentrancy and async interactions are hard to reason about
- **Suggestion**: Pass scope/context explicitly through function parameters or use a `BuildContext` / `RunContext` object threaded through the call chain

### Moderate

#### 4. Serialization contracts are implicit and distributed
- JSON shapes for `.proma` files are spread across `serialize.mjs`, `deserialize.mjs`, `validate.mjs`
- No single schema definition — drift between modules is likely
- **Suggestion**: Create a `schema.mjs` module with Zod or hand-written validators as the single source of truth. Generate TypeScript types from it.

#### 5. Mixed sync/async in registry loading
- `Registry#resolve` and `load` can return either sync values or Promises depending on resolver behavior
- Call sites must branch on return type
- **Suggestion**: Make the registry consistently async. Use `Promise.resolve()` to normalize sync resolvers.

#### 6. `edit.addChip` is stringly-typed with regex parsing
- Accepts chip classes, instances, registry names, and custom URI syntax (`uri:event(...)`)
- Control flow branches are non-uniform and hard to validate statically
- **Suggestion**: Split into explicit methods: `addChipByClass()`, `addChipByURI()`, `addChipByInstance()`. Or use a discriminated union input type.

#### 7. Compilation mutates shared port metadata
- Compiler functions cached by mutating `portInfo.compiler`, `portInfo.computeCompiler`, `portInfo.executeCompiler`
- Compilation order can influence behavior subtly
- Parallel compilations against shared `ChipInfo` graphs are unsafe
- **Suggestion**: Store compilation artifacts in a separate `CompilationResult` map keyed by port identity, not on the port itself

#### 8. Runtime code generation via `new Function(...)`
- Dynamic function creation from strings in `api.mjs` and `run.mjs`
- Harder to secure, audit, and debug (weak stack traces)
- Blocked in CSP-restricted environments
- **Suggestion**: Consider generating module code that can be `import()`-ed, or use the compilation pipeline to produce importable artifacts

### Minor

#### 9. Hand-rolled type parser is mutation-heavy
- Custom grammar parser in `types.mjs` mutates token arrays in-place
- Parsing, matching, checking, and serialization are tightly coupled
- **Suggestion**: Consider a small parser combinator library or at least separate the parser from the checker. Immutable token streams would improve debuggability.

#### 10. Mixed endpoint representations in connection containers
- `inputs`/`outputs` and connection maps hold `PortOutlet`, `PortInfo`, and `Port` depending on code path
- Methods branch on `instanceof` to normalize
- **Suggestion**: Introduce a `PortRef` abstraction that all containers use, with methods to resolve to the concrete type when needed

#### 11. Wire initialization uses retry loop
- `Wire.svelte` retries up to 8 times on mount to find port outlet elements
- Indicates a timing issue between chip rendering and wire registration
- **Suggestion**: Use a port registration callback or event rather than polling. The board could maintain a `portReady` promise map.

---

## Test Coverage Gaps

| Area | Status | Gap |
|------|--------|-----|
| proma-core compiler | Good (24 test files) | Some output compilation TODOs remain |
| proma-core edit API | Good | Connection validation edge cases |
| proma-core variadic | Partial | Ordering and accounting tests incomplete |
| proma-svelte-components | Storybook only | No unit tests for Board, Chip, Wire interaction |
| proma-web | 2 spec files | Missing tests for file management, project export, editor switching |

**Suggestion**: Add integration tests for the UI layer using Playwright — test chip creation, wire connection, and compilation round-trip in the browser.

---

## Suggestions for Continuation

### High Priority

1. **Break up `compile.mjs`** — This is the single highest-risk file. Splitting it into focused modules with clear phase boundaries will reduce regression risk and improve onboarding.

2. **Formalize the `.proma` schema** — A single schema definition (even as a TypeScript type + runtime validator) would prevent serialize/deserialize drift and serve as documentation.

3. **Add CI/CD** — No GitHub Actions workflows exist. At minimum, add:
   - `pnpm install && pnpm check && pnpm test` on PR
   - `pnpm build` to catch build regressions
   - Consider Storybook visual regression testing

4. **Integration tests for the visual editor** — Use Playwright to test the full loop: create chip → connect wires → compile → verify output. This protects against UI/core integration regressions.

### Medium Priority

5. **Replace `Port extends Function`** — Design an RFC for a plain-object callable wrapper. This unblocks better TypeScript modeling and reduces fragility.

6. **Make registry consistently async** — Simplifies call sites and prevents subtle bugs from mixed sync/async returns.

7. **Externalize compilation artifacts** — Stop mutating `PortInfo` during compilation. Use a separate result map to make compilation stateless and parallelizable.

8. **Improve error reporting** — Compilation and deserialization errors are minimal. Add structured error types with source location info (chip ID, port name, wire endpoints).

### Nice to Have

9. **Extract standard library into separate package** — `core/library/` could become `@proma/stdlib` to allow community extensions and reduce core size.

10. **Type-safe event system** — The shortcut dispatcher in `shortcuts.js` uses string-based event matching. A typed event map would catch mismatches at compile time.

11. **Storybook coverage for all board components** — Currently partial. Full stories for Wire, Port, and Board interactions would serve as living documentation.

12. **Documentation for the `.proma` file format** — The JSON structure is undocumented beyond code. A spec would help third-party tool developers.

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
| `core/compile.mjs` | 1,000 | Monolithic compilation |
| `core/edit.mjs` | 800+ | Mixed concerns (editing, validation, events) |
| `core/ports.mjs` | 600+ | Port classes + metadata + runtime |
| `core/types.mjs` | 600+ | Parser + matcher + checker |
| `Board.svelte` | 857 | Canvas + selection + wire creation + pan/zoom |
| `ChipBoardView.svelte` | 553 | Data model bridge + event handling |

---

*Generated from automated codebase exploration, February 2026.*
