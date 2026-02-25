# proma-web

A pure SvelteKit web app for creating, editing, and running Proma visual programs in the browser.

## Overview

`proma-web` is frontend-only and does not use a backend service.

- Built with **SvelteKit**
- Uses **@proma/core** for compilation/runtime
- Uses **@proma/svelte-components** for the visual editor
- Stores project data in browser local storage

## Prerequisites

- Node.js (v18 or later recommended)
- pnpm

## Local Development

From `packages/proma-web`:

```bash
pnpm install
pnpm dev
```

App URL: `http://localhost:5173` (default Vite dev port).

## Scripts

```bash
pnpm dev           # Start SvelteKit dev server
pnpm build         # Production build
pnpm preview       # Preview production build
pnpm check         # Type + Svelte checks
pnpm lint          # Prettier + ESLint
pnpm format        # Format code
pnpm test          # Run unit tests
```

## Routes

- `/` - Landing page
- `/playground` - Browser-only editor/playground

## Project Structure

```text
proma-web/
├── src/
│   ├── routes/
│   └── lib/
├── static/
├── svelte.config.js
├── vite.config.js
└── package.json
```
