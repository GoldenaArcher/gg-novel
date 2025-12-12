# GG Novel Desktop

A modern Electron + React writing environment tailored for multi-project novel workflows. The renderer uses Vite, TypeScript, and a Sass-powered design system that supports light/dark themes, while the Electron main process handles the desktop shell and packaging.

See `CONTEXT.md` for a detailed directory walkthrough and per-feature explanation.

## Scripts

- `npm run dev`: Starts Vite dev server with Electron in watch mode.
- `npm run build`: Type-checks the project, builds the renderer and Electron bundles, and then runs `electron-builder` (requires network to download platform binaries).
- `npm run preview`: Serves the built renderer bundle for quick inspection.
- `npm run lint`: Runs ESLint with the repo’s TypeScript/React rules.

Feel free to keep expanding this document as new features or conventions are added.
