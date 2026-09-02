# Edafter Google Apps Script app

React + TypeScript + Ant Design web app bundled with Vite and deployed through Google CLASP.

## Local development

```sh
npm install
npm run dev
```

## Google Apps Script setup

1. Install CLASP globally if it is not available: `npm install -g @google/clasp`.
2. Enable the Apps Script API in the Google account used for deployment.
3. Authenticate with `clasp login`.
4. Create a standalone Apps Script project, copy its script ID, and create `.clasp.json` from `.clasp.json.example`.
5. Replace the example `scriptId` with the real ID. Keep `.clasp.json` out of source control.

## Build and deploy

```sh
npm run build
npm run clasp:push
npm run clasp:deploy
npm run clasp:open
```

The build places the Vite output, `Code.gs`, and `appsscript.json` in `dist`, which is the CLASP root directory. After deploying, use the Apps Script deployment URL for the web app.# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
