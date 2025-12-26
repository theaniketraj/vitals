import * as vscode from "vscode";
import { getWebviewContent } from "./utils/webviewUtils";
import { PrometheusApi } from "./api";
import { getUsageStats } from "./telemetry/usageStats";

export class VitalsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "vitals.dashboardView";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "webview", "build"),
      ],
    };

    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this._extensionUri
    );

    // Listen for configuration changes
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("vitals.prometheusUrl")) {
        this.sendPrometheusConfig(webviewView.webview);
      }
    });

    webviewView.onDidDispose(() => {
      configListener.dispose();
    });

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "getPrometheusUrl": {
          this.sendPrometheusConfig(webviewView.webview);
          break;
        }

        case "configurePrometheus":
          // Trigger the configure Prometheus command
          vscode.commands.executeCommand("vitals.configurePrometheus");
          break;

        case "openGitHubRepo":
          vscode.env.openExternal(vscode.Uri.parse("https://github.com/theaniketraj/vitals"));
          break;

        case "openSettings":
          vscode.commands.executeCommand("workbench.action.openSettings", "@ext:theaniketraj.vitals");
          break;

        case "fetchMetrics":
          // Track metrics feature usage
          getUsageStats(this._context).trackFeature("metrics");

          try {
            const config = vscode.workspace.getConfiguration("vitals");
            const prometheusUrl =
              config.get<string>("prometheusUrl") || "https://prometheus.demo.do.prometheus.io:9090";
            const api = new PrometheusApi(prometheusUrl);

            // Calculate range for the last 30 minutes
            const end = Math.floor(Date.now() / 1000);
            const start = end - 30 * 60; // 30 minutes ago
            const step = 15; // 15 seconds resolution

            const data = await api.queryRange(message.query, start, end, step);
            webviewView.webview.postMessage({
              command: "updateMetrics",
              data,
            });
          } catch (error: any) {
            getUsageStats(this._context).trackError(
              "prometheus_metrics_fetch_failed"
            );

            console.log(`Prometheus fetch error: ${error.message}`);
            webviewView.webview.postMessage({
              command: "error",
              message: error.message,
            });
          }
          break;

        case "fetchAlerts":
          // Track alerts feature usage
          getUsageStats(this._context).trackFeature("alerts");

          try {
            const config = vscode.workspace.getConfiguration("vitals");
            const prometheusUrl =
              config.get<string>("prometheusUrl") || "https://prometheus.demo.do.prometheus.io:9090";
            const api = new PrometheusApi(prometheusUrl);

            const data = await api.getAlerts();
            webviewView.webview.postMessage({
              command: "updateAlerts",
              data,
            });
          } catch (error: any) {
            getUsageStats(this._context).trackError(
              "prometheus_alerts_fetch_failed"
            );
            console.log(`Failed to fetch alerts: ${error.message}`);
            webviewView.webview.postMessage({
              command: "alertError",
              message: error.message,
            });
          }
          break;

        case "fetchKPIs":
          try {
            const config = vscode.workspace.getConfiguration("vitals");
            const prometheusUrl =
              config.get<string>("prometheusUrl") || "https://prometheus.demo.do.prometheus.io:9090";
            const api = new PrometheusApi(prometheusUrl);

            // Fetch KPIs in parallel
            // We use sum() to aggregate across all instances/jobs for a global view
            const [reqRate, errRate, latency] = await Promise.all([
              api.query('sum(rate(prometheus_http_requests_total[5m]))'),
              api.query('sum(rate(prometheus_http_requests_total{code=~"5.."}[5m])) / sum(rate(prometheus_http_requests_total[5m]))'),
              api.query('sum(rate(prometheus_http_request_duration_seconds_sum[5m])) / sum(rate(prometheus_http_request_duration_seconds_count[5m]))')
            ]);

            // Helper to extract scalar value safely
            const getScalarValue = (result: any, decimals = 2, multiplier = 1): string => {
              try {
                // result.data.result should be an array. If we used sum(), it usually has 1 element if data exists.
                const valStr = result?.data?.result?.[0]?.value?.[1];
                if (!valStr) return "0";

                const val = Number.parseFloat(valStr);
                if (Number.isNaN(val) || !Number.isFinite(val)) return "0";

                return (val * multiplier).toFixed(decimals);
              } catch {
                return "0";
              }
            };

            // Send success status
            webviewView.webview.postMessage({
              command: "updateStatus",
              status: "connected"
            });

            webviewView.webview.postMessage({
              command: "updateKPIs",
              data: {
                requestRate: `${getScalarValue(reqRate, 2)}/s`,
                errorRate: `${getScalarValue(errRate, 2, 100)}%`,
                avgLatency: `${getScalarValue(latency, 0, 1000)}ms`
              },
            });
          } catch (error: any) {
            console.log(`Failed to fetch KPIs: ${error.message}`);

            // Send error status
            webviewView.webview.postMessage({
              command: "updateStatus",
              status: "error",
              error: error.message
            });
          }
          break;

        case "fetchLogs": {
          // Track logs feature usage
          getUsageStats(this._context).trackFeature("logs");

          // Mock log data for now as Prometheus doesn't have a standard logs endpoint
          // In a real scenario, this would connect to Loki or another log source
          const mockLogs = [
            `[INFO] Application started at ${new Date().toISOString()}`,
            `[INFO] Connected to database`,
            `[WARN] High memory usage detected`,
            `[INFO] Request processed in 45ms`,
          ];
          webviewView.webview.postMessage({
            command: "updateLogs",
            data: mockLogs,
          });
          break;
        }

        case "fetchCustomMetrics": {
          getUsageStats(this._context).trackFeature("custom_metrics");
          try {
            const config = vscode.workspace.getConfiguration("vitals");
            const prometheusUrl =
              config.get<string>("prometheusUrl") || "https://prometheus.demo.do.prometheus.io:9090";
            const api = new PrometheusApi(prometheusUrl);
            const customQueries = config.get<any[]>("customQueries") || [];

            const end = Math.floor(Date.now() / 1000);
            const start = end - 30 * 60; // 30 minutes
            const step = 15;

            const results = await Promise.all(
              customQueries.map(async (cq) => {
                try {
                  const result = await api.queryRange(cq.query, start, end, step);
                  return {
                    name: cq.name,
                    data: result,
                    error: null
                  };
                } catch (e: any) {
                  return {
                    name: cq.name,
                    data: null,
                    error: e.message
                  };
                }
              })
            );

            webviewView.webview.postMessage({
              command: "updateCustomMetrics",
              data: results
            });
          } catch (error: any) {
            console.error(`Failed to fetch custom metrics: ${error.message}`);
          }
          break;
        }
      }
    });
  }

  public show() {
    if (this._view) {
      this._view.show?.(true);
    } else {
      // Fallback to command if view is not yet resolved
      vscode.commands.executeCommand('vitals.dashboardView.focus');
    }
  }

  private sendPrometheusConfig(webview: vscode.Webview) {
    const config = vscode.workspace.getConfiguration("vitals");
    const prometheusUrl =
      config.get<string>("prometheusUrl") || "https://prometheus.demo.do.prometheus.io:9090";
    const defaultUrl = config.inspect("prometheusUrl")
      ?.defaultValue as string;
    const isDemoMode = prometheusUrl === defaultUrl;

    webview.postMessage({
      command: "prometheusUrl",
      url: prometheusUrl,
      isDemoMode: isDemoMode,
    });
  }
}
