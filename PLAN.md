# Figma Plugin Template Closeout

Status snapshot: July 17, 2026. This file tracks the final hardening and release
of the reusable template; checked items were verified before this hardening pass.

## Locked contract

- npm-based standalone template; Node 24 LTS preferred, Node `^22.13.0 || ^24.0.0` supported.
- React + TypeScript + Tailwind CSS v4 UI, with a DOM-free Figma sandbox bundle.
- Root `manifest.json` points to `dist/code.js` and `dist/index.html`.
- The strict two-file `dist/` shape is this template's policy, not a universal Figma rule.
- Sandbox output stays ES2020; the UI has all JavaScript and CSS inlined.
- Shared runtime-checked messages are the only UI/sandbox boundary.
- Vitest covers durable logic; no browser transport mock, jsdom, or Testing Library.
- MIT-licensed repository published as a GitHub template.

## Baseline verified — July 17, 2026

- [x] npm install, formatting, type-checking, and linting passed.
- [x] Production build emitted only `dist/code.js` and `dist/index.html`.
- [x] The UI was self-contained and the sandbox bundle passed `node --check`.
- [x] UI-only and sandbox-only watch edits rebuilt while preserving both artifacts.
- [x] Shared guards, count normalization, Tailwind theming, and the rectangle round trip landed.

## Hardening implementation

- [x] Upgrade the supported Node/Vite/React/TypeScript toolchain and declare engines.
- [x] Improve UI sizing, spacing, fallbacks, focus states, and error presentation.
- [x] Center created grids and add rollback, selection restoration, and separate undo boundaries.
- [x] Add the typed `shapes-creation-failed` sandbox-to-UI response.
- [x] Refactor artifact verification to parse scripts, HTML, and the root manifest.
- [x] Add Vitest coverage for messages, the mocked Figma runtime, and artifact fixtures.
- [x] Add the Node 22/24 GitHub Actions matrix with read-only repository permissions.
- [x] Finish README, Node metadata, MIT license, and template-ready project metadata.

## Automated acceptance

- [x] `npm ci` succeeds from a clean source copy on supported Node versions.
- [x] `npm run check` passes formatting, linting, tests, type-checking, and production build.
- [x] `npm audit --audit-level=high` reports no high-or-higher findings.
- [x] Watch smoke tests pass after separate `src/` and `lib/` edits.
- [ ] GitHub Actions passes on Node 22 and Node 24.

## Figma Desktop acceptance

- [ ] Import the root manifest and run without console errors.
- [ ] Verify the UI and keyboard focus in light and dark themes.
- [ ] Create counts 1 and 100; verify centered selection, zoom, and success status.
- [ ] Verify blank, fractional, and out-of-range values normalize correctly.
- [ ] Run Create twice and confirm each operation has its own Undo boundary.
- [ ] Trigger or simulate failure; confirm rollback, restored selection, and retryable error UI.
- [ ] Confirm Cancel closes the plugin.
- [ ] Confirm UI and sandbox edits restart the plugin with hot reload enabled.
- [ ] Repeat final runtime checks with Developer VM disabled.

## Publication

- [ ] Commit the completed scaffold and hardening changes.
- [ ] Push `main` and verify the GitHub Actions run completes successfully.
- [ ] Enable GitHub template mode and verify the remote template and MIT license metadata.
