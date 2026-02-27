# proma-core Architecture / Code Smells

Canonical analysis of `@proma/core` — confirmed issues, test coverage gaps, and the improvement backlog.

---

## 1) Callable-object port model is fragile

- **Location**: `packages/proma-core/core/ports.mjs`, `packages/proma-core/core/run.mjs`
- **Pattern**: `class Port extends Function` / `class PortOutlet extends Function`. The constructor calls `makePortRun(portInfo)` to produce a plain function, then calls `Object.setPrototypeOf(self, Port.prototype)` and attaches all runtime members (`chip`, `name`, `fullName`, `isInput`, `isOutput`, `isFlow`, `isData`, `type`, `defaultValue`, `isConcealed`, `isCanonical`, etc.) via `Object.defineProperties`.
- **Risks**:
  - Easy to break runtime behavior when adding type-declaration accessors (already hit with `explicitValue`).
  - TS/JSDoc sees a narrower surface than runtime, forcing repeated `any` casts even in valid call paths.
  - Debuggability and maintainability are lower than a plain object/class model.
- **Suggestion**: Replace with a plain-object callable wrapper — a `port.call()` method or a `Proxy` with an `apply` trap would preserve the calling convention while being type-safe.

## 2) Global mutable context stack is implicit coupling

- **Location**: `packages/proma-core/core/utils.mjs` (module-level `contextStack`), consumed in `api.mjs`, `run.mjs`, `edit.mjs`
- **Pattern**: A module-level array is pushed/popped via `context.push` / `context.pop` during chip construction and execution. Build and runtime behaviors depend on `context(...)` state.
- **Risks**:
  - Hidden control flow and non-local side effects — APIs appear pure but require ambient state.
  - Reentrancy and async interactions are harder to reason about and test.
- **Suggestion**: Pass scope/context explicitly through function parameters or use a `BuildContext` / `RunContext` object threaded through the call chain.

## 3) Runtime code generation via `new Function(...)`

- **Location**: `packages/proma-core/core/api.mjs:536`, `run.mjs:494`, `edit.mjs:1392`, `types.mjs:174`
- **Pattern**: Dynamic function/class creation from strings at four separate call sites.
- **Risks**:
  - Harder to secure and audit.
  - Weak tooling support for stack traces and static analysis.
  - Blocked in CSP-restricted environments.
- **Suggestion**: Consider generating module code that can be `import()`-ed, or use the compilation pipeline to produce importable artifacts.

## 4) AST injection cursor logic is subtle and bug-prone

- **Location**: `packages/proma-core/core/compile-utils.mjs`
- **Pattern**: Multi-pass AST rewrite + declaration injection with per-scope cursor bookkeeping.
- **Risks**:
  - Ordering bugs are easy to introduce (one cursor comparison bug was already found and fixed).
  - Nested scope and multi-injection behavior can regress silently.
- **Mitigation already added**: Regression test at `packages/proma-core/test/core/compile-utils.test.mjs`.

## 5) Serialization contracts are weakly typed and distributed

- **Location**: `packages/proma-core/core/serialize.mjs`, `deserialize.mjs`, `validate.mjs`, tests
- **Pattern**: Shared JSON shapes (the `.proma` file format) are implicit and spread across modules without a single schema definition.
- **Risks**:
  - Drift between serialize/deserialize/validate behavior.
  - More `any` leakage into public/core APIs.
  - Harder for contributors to know the canonical schema.
- **Suggestion**: Create a `schema.mjs` module (with Zod or hand-written validators) as the single source of truth. Generate TypeScript types from it.

## 6) Known semantics gaps called out in TODO/FIX comments

- **Location**: mainly `packages/proma-core/core/run.mjs`, `ports.mjs`, `chip.mjs`, `compile.mjs`
- **Examples**:
  - `computeOn` runtime semantics and run-value signaling are marked as unclear.
  - Hidden output-data ports not fully enforced.
  - Naming/structure TODOs around chip identity and outlet/path handling.
  - `compile.mjs` has a TODO for compiling each input exec port.
- **Risks**:
  - Behavior edge cases can diverge from intended model.
  - Compiler/runtime parity can drift.

## 7) Mixed sync/async API contracts in registry loading

- **Location**: `packages/proma-core/core/registry.mjs` (`#resolve`)
- **Pattern**: `#resolve` returns `false` (sync, no resolver matched), `true` (sync, resolved), or `Promise<void>` (async). Call sites must branch on return type.
- **Risks**:
  - Increased call-site complexity.
  - Easy to introduce subtle control-flow bugs when extending resolver logic.
  - Harder to provide a strongly typed, predictable public API.
- **Suggestion**: Make the registry consistently async. Use `Promise.resolve()` to normalize sync resolvers.

## 8) Compilation mutates shared port metadata as implicit cache/state

- **Location**: `packages/proma-core/core/compile.mjs:234–249`, `compile-port-compilers.mjs:162,625,662`
- **Pattern**:
  - Compiler functions are cached by mutating `portInfo.compiler` on the shared `PortInfo` object.
  - Runtime compilation state also mutates `portInfo.$isPushing` during output-flow compilation.
- **Risks**:
  - Compilation order can influence behavior in subtle ways.
  - Parallel/overlapping compilations against shared `ChipInfo` graphs are unsafe.
  - Side effects blur boundaries between immutable model metadata and transient compilation state.
- **Suggestion**: Store compilation artifacts in a separate `CompilationResult` map keyed by port identity, not on the port itself.

## 9) ~~`compile.mjs` is a high-complexity monolith~~ — Partially resolved (PR #53)

- **Original concern**: A single ~1k-line module mixed traversal, scope resolution, AST generation, compiler caching, and wrapper adaptation.
- **Resolved in PR #53**: Split into three focused modules:
  - `compile-helpers.mjs` (~120 lines) — graph traversal/scope helpers (`isOutlet`, `getHookPorts`, etc.)
  - `compile-port-compilers.mjs` (~520 lines) — all six port compiler factories with dependency injection via `ctx`
  - `compile.mjs` (~220 lines) — public `Compilation` class + `compile()`/`compiler()` dispatch
- **Remaining concern**: `compile-port-compilers.mjs` at ~520 lines still mixes multiple compiler factories. The `portInfo.compiler` mutation (see smell #8) persists.

## 10) `edit.addChip` is a stringly-typed multi-mode entrypoint

- **Location**: `packages/proma-core/core/edit.mjs`
- **Pattern**: One method accepts chip classes, instances, registry names, and a custom URI syntax (`uri:event(...)`, `uri:switch(...)`, `uri:external(...)`) parsed with `CUSTOM_CHIP_REGEXP`. Control flow branches across registry loading, placeholder creation, and direct instantiation.
- **Risks**:
  - Hard to model and validate inputs statically.
  - Error paths are non-uniform, making behavior less predictable for callers.
  - Adding custom chip syntax increases coupling between parser logic and editor behavior.
- **Suggestion**: Split into explicit methods: `addChipByClass()`, `addChipByURI()`, `addChipByInstance()`. Or use a discriminated union input type.

## 11) Mixed endpoint representations in connection containers

- **Location**: `packages/proma-core/core/chip.mjs` (and consumers in `edit.mjs`, `compile.mjs`)
- **Pattern**: `ChipConnectionEndpoint` is typed as `PortInfo | Port | PlaceholderPort`, and `PortSelector` accepts even broader input (`string | string[] | number | Chip | Port | PortOutlet | PortInfo`). Several methods branch on runtime `instanceof` to normalize endpoints.
- **Risks**:
  - Type modeling becomes weak and forces broad `any` usage.
  - Higher chance of subtle mismatches when code assumes a specific endpoint shape.
  - Refactors in one layer (editor/runtime/compiler) can silently break another.
- **Suggestion**: Introduce a `PortRef` abstraction that all containers use, with a method to resolve to the concrete type when needed.

## 12) Hand-rolled type-signature parser is high-complexity and mutation-heavy

- **Location**: `packages/proma-core/core/types.mjs` (~600 lines)
- **Pattern**: Custom grammar parser mutates token arrays in-place across many small consumers (`consume*`, `maybeConsume*`). Parsing, matching, checking, and serialization are tightly coupled in one module. Also uses `new Function(...)` for type-reference resolution.
- **Risks**:
  - Hard to reason about parser edge cases and error diagnostics.
  - Type-related changes require touching multiple interdependent paths.
  - Static typing improvements are slower because structures are mostly implicit/dynamic.
- **Suggestion**: Consider a small parser combinator library, or at minimum separate the parser from the checker and use immutable token streams.

## 13) `Registry.add` accepts recursive polymorphic inputs

- **Location**: `packages/proma-core/core/registry.mjs`
- **Pattern**: `add` (and the private `#add`) accepts a chip class, an array of chip classes, or an object whose values are arrays/chips. Normalization is done recursively at runtime.
- **Risks**:
  - Hard to express and enforce with static types, leading to wider `any`/casts around registry operations.
  - Validation errors are pushed to runtime and can surface late.
  - Makes API behavior less predictable for contributors extending registry logic.

## 14) Port runtime shape diverges from declared class surface

- **Location**: `packages/proma-core/core/ports.mjs`, consumers in `edit.mjs`
- **Pattern**: `Port` instances receive key members (`isInput`, `isData`, `type`, `defaultValue`, `isConcealed`, `isCanonical`, `isRequired`, `isHidden`, `variadic`, etc.) via `Object.defineProperties` at construction time. Those members are not represented as explicit class members or getters in the class body — only documented in a `PortRuntimeShape` JSDoc typedef.
- **Risks**:
  - Editor/type-checking requires repeated casts even in valid call paths.
  - Refactors may accidentally rely on undeclared runtime-only properties.
  - Public API typing remains weaker than actual behavior, slowing type coverage progress.

---

## Test Coverage Gaps

| Area | Status | Gap |
|------|--------|-----|
| Compiler (compile.mjs et al.) | Good (24 test files) | Some output compilation TODOs remain |
| Edit API | Good | Connection validation edge cases |
| Variadic ports | Partial | Ordering and accounting tests incomplete |
| Registry | Minimal | Async resolver paths and error cases under-tested |
| Serialization round-trip | Partial | Drift between serialize/deserialize/validate not caught by tests |

---

## Improvement Backlog

Ordered by impact:

1. **Design RFC for replacing `Port extends Function`** with a plain-object callable wrapper model. Unblocks better TypeScript modeling, reduces cast noise, and reduces fragility. (Addresses smells #1 and #14.)

2. **Formalize the `.proma` schema** — A single schema definition (even a TypeScript type + runtime validator) prevents serialize/deserialize drift and serves as documentation. (Addresses smell #5.)

3. **Isolate build/runtime context** — Replace the ambient `contextStack` with explicit scope objects or API parameters threaded through the call chain. (Addresses smell #2.)

4. **Externalize compilation artifacts** — Stop mutating `portInfo.compiler` and `portInfo.$isPushing` during compilation. Use a separate `CompilationResult` map keyed by port identity. (Addresses smell #8.)

5. **Make registry consistently async** — Simplifies call sites and prevents subtle bugs from mixed sync/async returns. (Addresses smell #7.)

6. **Expand compile-utils regression tests** — Cover nested blocks, branches, and repeated output rewrites. (Addresses smell #4.)

7. **Resolve top TODO/FIX semantics in `run.mjs`** — `computeOn`, cache semantics, hidden output enforcement. (Addresses smell #6.)

8. **Improve error reporting** — Add structured error types with source location info (chip ID, port name, wire endpoints) to compilation and deserialization errors.

---

*Last updated: February 2026.*
