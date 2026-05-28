# Prompt footer modes + Memory UI - what broke and fixes

## Symptoms

- The new dropdowns (Thinking mode and Chat mode) did not appear in the prompt footer UI.
- `TypeError: client(...).get is not a function` when opening Memory settings UI.
- Desktop dev start confusion: running `bun dev:desktop` from `packages/desktop` failed.

## Root causes

### 1) Dropdowns were added in one render path, but the screenshot used a different render path

`packages/app/src/components/prompt-input.tsx` has multiple prompt footer layouts. The footer in the screenshot was rendering `modelControl()` only, so any dropdowns rendered outside of `modelControl()` never showed up there.

### 2) UI was using the SDK OpenAPI client like a raw HTTP client

The generated SDK client is a typed OpenAPI client, not a generic REST wrapper. It does not expose `.get()` and `.post()` methods.

### 3) Dev script location mismatch

`dev:desktop` is defined at the repo root and shells into `packages/desktop`. Running it inside `packages/desktop` fails because that package does not define `dev:desktop`.

## Fixes applied

### 1) Render the dropdowns inside `modelControl()` so they appear in all footer layouts

Implemented both the Thinking variant control and Chat mode control as part of `modelControl()` in:

- `packages/app/src/components/prompt-input.tsx`

This makes them show up in the minimal footer layout that only calls `modelControl()`, including the one visible in the screenshot.

### 2) Add a `fetch`-based instance HTTP utility and use it for Memory UI

Created a small `fetch` wrapper for instance requests:

- `packages/app/src/utils/instance-http.ts`

Then updated Memory UI call sites to use it instead of `client().get()`:

- `packages/app/src/components/settings-memory.tsx`
- `packages/app/src/components/session/memory-panel.tsx`
- `packages/app/src/pages/monitor.tsx`

### 3) Tool restrictions for modes

Prompt submission now enforces tool permissions based on selected mode:

- **Plan**: denies all tools
- **Research**: denies sensitive tools (edit, shell, task, repo clone, external directory)
- **Build**: default, no additional restrictions

Files:

- `packages/app/src/components/prompt-input/submit.ts`
- `packages/app/src/components/prompt-input/submit.test.ts`

## Verification

### Typecheck (app)

Run from the package directory:

```bash
cd packages/app
bun typecheck
```

### Desktop dev

Run from repo root:

```bash
bun dev:desktop
```

Notes:

- If `Port 5173 is in use`, Electron Vite will bump to another port (for example `5174`).
- If you see `Cannot start http server for devtools`, another Electron/Chrome debugging instance is holding that port. Close other dev instances and retry.

## Practical guardrails (so we do not step on this rake again)

- Always verify which prompt footer path you are looking at. If a footer layout only renders `modelControl()`, controls rendered elsewhere will not show up.
- Treat the SDK OpenAPI client as typed endpoints, not as a generic `.get()` API. Use `fetch` directly for ad-hoc endpoints, or add proper generated endpoints.
- Run `bun dev:desktop` from repo root, not from `packages/desktop`.

