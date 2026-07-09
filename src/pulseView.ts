import * as vscode from "vscode";
import * as path from "node:path";
import { getWebviewContent } from "./utils/webviewUtils";
import { PrometheusApi } from "./api";

// Class to manage the Webview panel for the Vitals dashboard
export class VitalsView {
  public static currentPanel: VitalsView | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private readonly _disposables: vscode.Disposable[] = [];

  // Constructor to initialize the Webview panel
  private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
    this._panel = panel;
    this._extensionPath = extensionPath;

    // Set the Webview content (HTML with React bundle)
    this._panel.webview.html = getWebviewContent(
      this._panel.webview,
      vscode.Uri.file(extensionPath)
    );

    // Handle messages from the Webview (e.g., fetch metrics)
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "fetchMetrics":
            try {
              const config = vscode.workspace.getConfiguration("vitals");
              const prometheusUrl =
                config.get<string>("prometheusUrl") || "http://localhost:9090";
              const api = new PrometheusApi(prometheusUrl);

              const data = await api.query(message.query);
              this._panel.webview.postMessage({
                command: "updateMetrics",
                data,
              });
            } catch (error: any) {
              vscode.window.showErrorMessage(
                `Vitals: Failed to fetch metrics. ${error.message}`
              );
              console.error(error);
              this._panel.webview.postMessage({
                command: "error",
                message: error.message,
              });
            }
            break;

          case "fetchAlerts":
            try {
              const config = vscode.workspace.getConfiguration("vitals");
              const prometheusUrl =
                config.get<string>("prometheusUrl") || "http://localhost:9090";
              const api = new PrometheusApi(prometheusUrl);

              const data = await api.getAlerts();
              this._panel.webview.postMessage({
                command: "updateAlerts",
                data,
              });
            } catch (error: any) {
              console.error("Failed to fetch alerts:", error);
              this._panel.webview.postMessage({
                command: "alertError",
                message: error.message,
              });
            }
            break;

          case "fetchLogs":
            // Mock log data for now as Prometheus doesn't have a standard logs endpoint
            // In a real scenario, this would connect to Loki or another log source
            { const mockLogs = [
              `[INFO] Application started at ${new Date().toISOString()}`,
              `[INFO] Connected to database`,
              `[WARN] High memory usage detected`,
              `[ERROR] Connection timeout to service-b`,
              `[INFO] Request processed in 45ms`,
            ];
            this._panel.webview.postMessage({
              command: "updateLogs",
              data: mockLogs,
            });
            break; }
        }
      },
      undefined,
      this._disposables
    );

    // Dispose the panel when closed
    this._panel.onDidDispose(
      () => this.dispose(),
      undefined,
      this._disposables
    );
  }

  // Create or show the Webview panel
  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    // Reuse existing panel if it exists
    if (VitalsView.currentPanel) {
      VitalsView.currentPanel._panel.reveal(column);
      return;
    }

    // Create a new Webview panel
    const panel = vscode.window.createWebviewPanel(
      "vitalsDashboard",
      "Vitals Dashboard",
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, "webview", "build")),
        ],
      }
    );

    // Initialize the panel
    VitalsView.currentPanel = new VitalsView(panel, context.extensionPath);
  }

  // Dispose the panel and clean up resources
  public dispose() {
    VitalsView.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
