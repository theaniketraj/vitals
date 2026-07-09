import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Acquire VS Code API once
const vscode = acquireVsCodeApi();
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App vscode={vscode} />);
}

console.log("Rendering Vitals");
function acquireVsCodeApi(): any {
  // @ts-ignore
  return globalThis.acquireVsCodeApi();
}
