# Vite Figma Plugin Template

A reusable Figma plugin starter with React 19, TypeScript, Tailwind CSS v4, and
Vite. It keeps Figma's sandbox separate from the browser UI and validates a
small, predictable production package.

The template intentionally emits exactly two files:

- `dist/code.js` — one ES2020 classic-script bundle for the Figma sandbox.
- `dist/index.html` — one self-contained UI document with its JavaScript and CSS inlined.

That two-file shape is a strict **template policy**, not a universal Figma
requirement. Import the root `manifest.json`; it points Figma at both outputs.

## Requirements

- Node.js 24 LTS recommended; Node `^22.13.0 || ^24.0.0` supported.
- npm. This repository intentionally remains outside its parent pnpm workspace.
- Figma Desktop for loading and testing the plugin.

## Start a plugin

Create a repository with GitHub's **Use this template** button, or copy it with
degit:

```bash
npx degit garrettsiegel/vite-figma-plugin my-plugin
cd my-plugin
```

Customize the clone before installing:

1. Change `name` in `package.json`.
2. Change `name` in `manifest.json`.
3. Replace the `manifest.json` `id` with an ID assigned to your plugin by Figma.
4. Update the document title in `index.html` and the visible title in `src/App.tsx`.

Do not invent an ID or publish with the template's checked-in ID. In Figma
Desktop, open **Plugins → Development → New Plugin…** and create a plugin to
receive an assigned ID, then copy that ID into this repository's manifest. See
Figma's [plugin quickstart](https://developers.figma.com/docs/plugins/plugin-quickstart-guide/)
for the current creation flow.

Install and run the complete project gate:

```bash
npm install
npm run check
```

## Load it in Figma

1. Run `npm run build`.
2. Open Figma Desktop.
3. Choose **Plugins → Development → Import plugin from manifest…**.
4. Select the repository's root `manifest.json`, not a file in `dist/`.
5. Run it from **Plugins → Development**.

Enter a count and choose **Create**. The sandbox creates a centered grid of
rectangles on the current page, selects it, zooms to it, and reports success to
the UI. **Cancel** closes the plugin.

## Two execution realms

The plugin is two programs connected only by validated messages:

| Realm     | Source | Available APIs                            | Output            |
| --------- | ------ | ----------------------------------------- | ----------------- |
| Sandbox   | `lib/` | `figma` and sandbox-safe APIs; no DOM     | `dist/code.js`    |
| UI iframe | `src/` | React and browser APIs; no `figma` global | `dist/index.html` |

`shared/messages.ts` owns the types, bounds, and runtime guards for both
directions. Treat every incoming message as untrusted even though both sides
are written in TypeScript.

## Development and debugging

Start the TypeScript, UI, and sandbox watchers together:

```bash
npm run watch
```

With Figma Desktop hot reload enabled, a completed rebuild restarts the plugin.
This is a process restart, not state-preserving Vite hot module replacement. If
hot reload is disabled, restart the plugin manually.

For layout work without Figma, use `npm run dev:ui`. The browser preview has no
Figma sandbox, so Create, Cancel, and sandbox responses do not work there.

Use Figma's Developer VM while debugging to inspect console output and runtime
failures, then disable it for final acceptance testing. Figma documents the
tools and limitations in its [debugging guide](https://developers.figma.com/docs/plugins/debugging/).

## Scripts

| Command                | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `npm run check`        | Run formatting checks, lint, tests, and the typechecked production build |
| `npm run build`        | Clean, type-check, build both realms, and verify `dist/`                 |
| `npm run watch`        | Watch types, UI, and sandbox for Figma development                       |
| `npm run dev`          | Alias for the Figma-compatible watch workflow                            |
| `npm run dev:ui`       | Start the browser-only Vite UI preview                                   |
| `npm test`             | Run the Vitest suite once                                                |
| `npm run test:watch`   | Run Vitest in watch mode                                                 |
| `npm run typecheck`    | Type-check UI, shared code, sandbox, and Vite configuration              |
| `npm run lint`         | Lint every realm, including accessibility and Figma rules                |
| `npm run format`       | Format project files with Prettier                                       |
| `npm run format:check` | Check formatting without writing files                                   |
| `npm run verify:dist`  | Enforce the manifest and strict two-file template contract               |
| `npm run clean`        | Remove generated output                                                  |
| `npm run preview`      | Preview the last production UI build in a browser                        |

GitHub Actions runs `npm ci` and `npm run check` on Node 22 and Node 24. Unit
tests cover the message boundary, count normalization, sandbox success and
rollback behavior, and production artifact validation. Figma Desktop remains
the final authority for plugin runtime behavior.

## Project map

| Path                      | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `manifest.json`           | Root Figma manifest; import this file                 |
| `index.html`              | Vite entry for the UI iframe                          |
| `src/`                    | React UI realm with DOM access                        |
| `lib/code.ts`             | Figma sandbox entry with no DOM access                |
| `shared/messages.ts`      | Shared message types, guards, and count normalization |
| `vite.config.ts`          | React, Tailwind, aliases, and single-file UI build    |
| `scripts/verify-dist.mjs` | Manifest and production artifact validation           |
| `scripts/watch-ui.mjs`    | Polling production watcher for reliable UI rebuilds   |
| `tests/`                  | Message, sandbox, and artifact tests                  |
| `dist/`                   | Generated `code.js` and `index.html`                  |

## Styling and themes

Tailwind v4 is wired through `@tailwindcss/vite`; there is no
`tailwind.config.js`. Add project tokens with CSS-first `@theme` blocks in
`src/index.css`.

The sandbox opens the UI with `themeColors: true`, and the CSS maps Figma's
`--figma-color-*` variables to accessible browser fallbacks. Test controls,
focus indicators, status messages, and hover states in both Figma themes.

## Dynamic page loading

The manifest uses `"documentAccess": "dynamic-page"`. Only the current page is
loaded initially, so the included current-page rectangle demo can remain
synchronous. For unloaded nodes or whole-document work, use targeted async APIs
such as `getNodeByIdAsync` and `page.loadAsync()`. Call
`figma.loadAllPagesAsync()` only when a full traversal is necessary. See Figma's
[dynamic loading guide](https://developers.figma.com/docs/plugins/migrating-to-dynamic-loading/).

## Manifest access controls

The starter has no special permissions or capabilities and disables network
access:

```json
"capabilities": [],
"networkAccess": {
  "allowedDomains": ["none"]
}
```

These controls are separate:

- `permissions` requests access to protected Figma data or APIs.
- `capabilities` enables specialized plugin modes such as code generation or inspection.
- `networkAccess` limits the URLs the sandbox and UI may contact.
- `documentAccess` controls how document pages are loaded.

Add only what the plugin needs. Put local services in `devAllowedDomains`; do
not loosen production network access for development convenience. Check the
current [manifest reference](https://developers.figma.com/docs/plugins/manifest/)
before adding editor types, permissions, capabilities, or domains.

## License

MIT. See [LICENSE](LICENSE). Fork it, use GitHub's template flow, or adapt it for
commercial and private plugins.
