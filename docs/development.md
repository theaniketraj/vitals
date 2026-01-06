---
title: Vitals Development Guide
description: Developer guide for contributing to Vitals - setup instructions, development workflow, testing, and debugging.
head:
  - - meta
    - name: keywords
      content: development guide, contributing, VS Code extension development, webpack, React development, debugging
---

# Development Guide

## Prerequisites

- Node.js 16+ and npm
- Visual Studio Code 1.94.0+
- Prometheus instance running locally (for testing)

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/theaniketraj/vitals.git
cd vitals
npm install
```

### 2. Start Prometheus (Optional)

For full development experience, run Prometheus locally:

```bash
docker run -p 9090:9090 prom/prometheus
```

### 3. Build

```bash
npm run build
```

Builds both extension and webview bundles.

### 4. Watch Mode

```bash
npm run watch
```

Starts webpack in watch mode for hot reloading during development.

## Project Structure

```bash
vitals/
├── src/                    # Extension source
│   ├── extension.ts       # Entry point
│   ├── vitalsView.ts       # Webview management
│   ├── api.ts             # Prometheus API client
│   ├── data/              # Data processing
│   ├── utils/             # Utilities
│   └── test/              # Unit tests
├── webview/               # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.tsx
│   └── tsconfig.json
├── webpack.config.js      # Extension webpack config
├── webpack.config.webview.js  # Webview webpack config
├── package.json
└── Docs/                  # Documentation
```

## Development Workflow

### Running the Extension

1. Open project in VS Code
2. Press `F5` to launch Extension Development Host
3. Extension loads in new window
4. Open Command Palette (Ctrl+Shift+P) and run "Open Vitals"

### Hot Reload

When using `npm run watch`:

- Extension changes: Reload extension (Ctrl+R in extension host)
- Webview changes: Auto-reload in panel

### Debugging

#### Extension Debugging

VS Code has built-in debugging for extension code. Set breakpoints in `src/*.ts` files.

#### Webview Debugging

1. In webview panel, right-click and select "Inspect"
2. DevTools opens for webview debugging

### Adding Features

#### New Prometheus Query

1. Add query handler in `vitalsView.ts`:

```typescript
case 'fetchNewData':
  const api = new PrometheusApi(prometheusUrl);
  const data = await api.query(message.query);
  this._panel.webview.postMessage({ command: 'updateNewData', data });
  break;
```

2. Add webview message sender in React hook:

```typescript
vscode.postMessage({ command: "fetchNewData", query: "your_query" });
```

3. Handle response in component

#### New UI Component

1. Create component in `webview/src/components/`
2. Import in parent component
3. Pass data via props

### Testing

```bash
npm run test
```

Runs Jest test suite.

#### Writing Tests

Tests located in `src/test/`:

```typescript
// api.test.ts
describe("PrometheusApi", () => {
  it("should fetch alerts", async () => {
    const api = new PrometheusApi("http://localhost:9090");
    const alerts = await api.getAlerts();
    expect(alerts.status).toBe("success");
  });
});
```

## Configuration

### VS Code Settings

Add to workspace `.vscode/settings.json`:

```json
{
  "vitals.prometheusUrl": "http://localhost:9090"
}
```

### Webpack Config

- `webpack.config.js` - Extension bundle
- `webpack.config.webview.js` - React webview bundle

Both use TypeScript loader and handle CSS/SCSS.

## Logging

Use `console.log()` for extension debugging:

```typescript
console.log("🚀 Vitals extension activated");
console.error("Error message", error);
```

View logs in:

- **Extension**: Debug Console in VS Code
- **Webview**: DevTools console

## Publishing

### Prerequisites for Publishing

- VSCode Marketplace account
- Personal Access Token (PAT)

### Build for Release

```bash
npm run vscode:prepublish
```

Optimizes bundles for production.

### Publish to Marketplace

```bash
vsce publish
```

or

```bash
vsce publish 0.3.0
```

For manual publishing, see [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

### Automated GitHub Release

We use GitHub Actions to automate releases. To create a new release with an attached `.vsix` file:

1.  Update the version in `package.json`.
2.  Push a new tag starting with `v` (e.g., `git tag v0.3.0 && git push origin v0.3.0`).
3.  The workflow will automatically build the extension and create a release on GitHub.

## Common Issues

### Build Failures

Clear cache and reinstall:

```bash
rm -rf node_modules dist webview/build
npm install
npm run build
```

### Webview Blank

Check:

1. Prometheus URL is correct in settings
2. Prometheus is running
3. Webview DevTools for errors

### Metrics Not Showing

1. Verify Prometheus is reachable
2. Check PromQL query syntax
3. View extension debug logs

## Performance Tips

1. Lazy load components in webview
2. Memoize expensive computations in React
3. Debounce metric queries
4. Use React DevTools for profiling

## Architecture Decisions

- **VS Code Webview**: Built-in, no additional dependencies
- **React**: Rich UI components and state management
- **Axios**: Simple HTTP client for Prometheus
- **Webpack**: Industry standard bundler
- **TypeScript**: Type safety and better DX

See [System Architecture](system_architecture.md) for details.
