# Figma Plugin Template Closeout

Status snapshot: July 17, 2026. A full file-by-file review pass found no
functional defects; the remaining work is publication, not redesign. This file
tracks the final closeout and the decisions that shaped it.

## Locked contract

- npm-based standalone template; Node 24 LTS preferred, Node `^22.13.0 || ^24.0.0` supported.
- React + TypeScript + Tailwind CSS v4 UI, with a DOM-free Figma sandbox bundle.
- Root `manifest.json` points to `dist/code.js` and `dist/index.html`.
- The strict two-file `dist/` shape is this template's policy, not a universal Figma rule.
- Sandbox output stays ES2020; the UI has all JavaScript and CSS inlined.
- Shared runtime-checked messages are the only UI/sandbox boundary.
- Vitest covers durable logic; no browser transport mock, jsdom, or Testing Library.
- MIT-licensed repository published as a GitHub template.

## Decisions (July 17, 2026 review)

- **Watch mode keeps always-on file polling.** `scripts/watch-ui.mjs` forces
  `usePolling` because native FSEvents can be dropped in sandboxed or
  containerized filesystems. Reliability across all environments was chosen over
  the small constant CPU cost; the tradeoff is documented in the script comment.
- **Publication is agent-driven** via the `gh` CLI (push, watch CI, enable
  template mode, set metadata). Figma Desktop runtime acceptance stays manual.

## Verified before publication

- [x] `npm run check` passes: format check, lint, Vitest, `tsc -b`, production build, `verify:dist`.
- [x] Production build emits only `dist/code.js` and `dist/index.html`.
- [x] The UI is self-contained and the sandbox bundle is valid classic-script JavaScript.
- [x] Shared guards, count normalization, Tailwind theming, and the rectangle round trip covered by tests.
- [x] Hygiene: `.firecrawl` git-ignored; `package.json` carries a description.

## Publication (agent-driven)

- [x] Commit closeout changes and push `main`.
- [x] GitHub Actions passes on Node 22 and Node 24.
- [x] Enable GitHub template mode; set description and topics via `gh repo edit`.
- [ ] Resolve the stale `feature/tailwind` remote branch. Owner: Garrett. It is
      not an ancestor of `main` — one commit ("tailwind setup") that predates and
      is superseded by the current Tailwind v4 integration. Delete
      (`git push origin --delete feature/tailwind`) once you confirm nothing on it
      is worth keeping.
- [x] Confirm a fresh `degit` copy passes `npm install && npm run check` (110 tests, build, verify all green).

## Figma Desktop acceptance — owner: Garrett

These require the Figma Desktop app and cannot be automated. Run after the
`main` push lands.

- [ ] Import the root manifest and run without console errors.
- [ ] Verify the UI and keyboard focus in light and dark themes.
- [ ] Create counts 1 and 100; verify centered selection, zoom, and success status.
- [ ] Verify blank, fractional, and out-of-range values normalize correctly.
- [ ] Run Create twice and confirm each operation has its own Undo boundary.
- [ ] Trigger or simulate failure; confirm rollback, restored selection, and retryable error UI.
- [ ] Confirm Cancel closes the plugin.
- [ ] Confirm UI and sandbox edits restart the plugin with hot reload enabled.
- [ ] Repeat final runtime checks with Developer VM disabled.

## Deliberately not doing (anti-overengineering guardrails)

Future agents should not "improve" the template into bloat. These omissions are
intentional:

- No jsdom / Testing Library UI tests — excluded by the locked contract.
- No pnpm / monorepo-workspace migration — npm standalone is the template's identity.
- No `npm audit` step in CI — flaky on new advisories; verified manually instead.
- No manifest placeholder-ID scheme — the README and "CHANGE ME" name cover it, and `verify-dist` requires a numeric ID.
- No button-disabling / pending state in `Count.tsx` — the sandbox responds synchronously.
- No changes to grid layout math, rollback logic, or the verifier — all reviewed, correct, and tested.
- No CHANGELOG or release tooling.
