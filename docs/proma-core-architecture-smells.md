# proma-core Architecture / Code Smells

This document tracks architecture and implementation smells found during the JSDoc/type-coverage upgrade work.

## 1) Callable-object port model is fragile

- Location: `packages/proma-core/core/ports.mjs`, `packages/proma-core/core/run.mjs`
- Pattern: `class Port extends Function` / `class PortOutlet extends Function`, constructor returns a wrapped function, then runtime properties are attached via `Object.defineProperties`.
- Risks:
  - Easy to break runtime behavior when adding type declaration accessors (we hit this with `explicitValue`).
  - Hard for TS/JSDoc to model reliably across files.
  - Debuggability and maintainability are lower than plain object/class models.

## 2) Global mutable context stack is implicit coupling

- Location: `packages/proma-core/core/api.mjs`, `packages/proma-core/core/run.mjs`, `packages/proma-core/core/utils.mjs`
- Pattern: Build and runtime behaviors depend on `context(...)` state.
- Risks:
  - Hidden control flow and non-local side effects.
  - Reentrancy/async interactions are harder to reason about and test.
  - Makes APIs appear pure while requiring ambient state.

## 3) Runtime code generation via `new Function(...)`

- Location: `packages/proma-core/core/api.mjs`, `packages/proma-core/core/run.mjs`
- Pattern: Dynamic function/class creation from strings.
- Risks:
  - Harder to secure and audit.
  - Weak tooling support for stack traces and static analysis.
  - Hard to enforce safe execution constraints in some environments.

## 4) AST injection cursor logic is subtle and bug-prone

- Location: `packages/proma-core/core/compile-utils.mjs`
- Pattern: Multi-pass AST rewrite + declaration injection with per-scope cursor bookkeeping.
- Risks:
  - Ordering bugs are easy to introduce (we fixed one cursor comparison bug).
  - Nested scope and multi-injection behavior can regress silently.
- Mitigation already added:
  - Regression test: `packages/proma-core/test/core/compile-utils.test.mjs`

## 5) Serialization contracts are weakly typed and distributed

- Location: `packages/proma-core/core/serialize.mjs`, `deserialize.mjs`, `validate.mjs`, tests
- Pattern: Shared JSON shapes are implicit and spread across modules.
- Risks:
  - Drift between serialize/deserialize/validate behavior.
  - More `any` leakage into public/core APIs.
  - Harder for contributors to know canonical schema.

## 6) Known semantics gaps called out in TODO/FIX comments

- Location: mainly `packages/proma-core/core/run.mjs`, `ports.mjs`, `chip.mjs`
- Examples:
  - `computeOn` runtime semantics and run-value signaling are marked as unclear.
  - Hidden output-data ports not fully enforced.
  - Some naming/structure TODOs around chip identity and outlet/path handling.
- Risks:
  - Behavior edge cases can diverge from intended model.
  - Compiler/runtime parity can drift.

## 7) Mixed sync/async API contracts in registry loading

- Location: `packages/proma-core/core/registry.mjs`
- Pattern: `#resolve` and `load` can return either synchronous values/booleans or Promises depending on resolver behavior.
- Risks:
  - Call sites must branch on return type (`value` vs `Promise<value>`), increasing complexity.
  - Easy to introduce subtle control-flow bugs when extending resolver logic.
  - Harder to provide strongly typed, predictable public API ergonomics.

## 8) Compilation mutates shared port metadata as implicit cache/state

- Location: `packages/proma-core/core/compile.mjs`
- Pattern:
  - Compiler functions are cached by mutating `portInfo.compiler`, `portInfo.computeCompiler`, `portInfo.executeCompiler`.
  - Runtime compilation state also mutates `portInfo.$isPushing`.
- Risks:
  - Compilation order can influence behavior in subtle ways.
  - Parallel/overlapping compilations against shared `ChipInfo` graphs are hard to make safe.
  - Side effects blur boundaries between immutable model metadata and transient compilation state.

## 9) `compile.mjs` is a high-complexity monolith

- Location: `packages/proma-core/core/compile.mjs`
- Pattern:
  - A single ~1k-line module mixes traversal, scope resolution, AST generation, compiler caching, and wrapper adaptation.
  - Multiple nested compiler factories rely on shared mutable conventions and implicit invariants.
- Risks:
  - High regression risk for small edits.
  - Difficult onboarding and weak locality of reasoning for new contributors.
  - Type coverage improvements are slower because signatures are deeply nested.

## Suggested follow-up backlog (after typing phases)

1. Design RFC for replacing callable `Function`-subclass ports with a plain-object callable wrapper model.
2. Isolate build/runtime context behind explicit scope objects or explicit API parameters.
3. Add a centralized schema/types module for serialized chip/port payloads.
4. Expand compile-utils regression tests for nested blocks, branches, and repeated output rewrites.
5. Resolve top TODO/FIX semantics in `run.mjs` (`computeOn`, cache semantics, hidden output enforcement).
