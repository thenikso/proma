# Proma

A visual programming language for JavaScript inspired by Unreal Engine Blueprints.

![playground-screenshot](./proma-playground-screenshot.jpg)

## Monorepo packages

- `packages/proma-core` - Core compiler/runtime for Proma chips
- `packages/proma-svelte-components` - Reusable Svelte editor components
- `packages/proma-web` - Pure SvelteKit web app and playground

## Quick start

```bash
pnpm install
pnpm bootstrap
```

Run web app:

```bash
cd packages/proma-web
pnpm dev
```

## Development

Root commands:

```bash
pnpm bootstrap
pnpm lint
pnpm format
```

When changing shared packages:

```bash
cd packages/proma-core && pnpm build
cd ../proma-svelte-components && pnpm build
cd ../proma-web && pnpm dev
```
