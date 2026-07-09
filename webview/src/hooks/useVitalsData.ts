import * as React from "react";

// Hook to fetch metrics and logs from the extension
export function useVitalsData(vscode: any) {
  const [metrics, setMetrics] = React.useState<any>(null);
  const [kpis, setKpis] = React.useState<any>({
    requestRate: "0/s",
    errorRate: "0%",
    avgLatency: "0ms",
  });
  const [logs, setLogs] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<
    "connected" | "error"
  >("connected");
  const [connectionError, setConnectionError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (!vscode) return;

    setLoading(true);
    setError(null);

    const fetchData = () => {
      // Use a more interesting metric for the chart (Request Rate History)
      vscode.postMessage({
        command: "fetchMetrics",
        query: "sum(rate(prometheus_http_requests_total[5m]))",
      });
      vscode.postMessage({ command: "fetchKPIs" });
      vscode.postMessage({ command: "fetchLogs" });
    };

    // Initial fetch
    fetchData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);

    // Handle messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "updateMetrics") {
        setMetrics(message.data);
        setError(null); // Clear error on success
        setLoading(false);
      } else if (message.command === "updateKPIs") {
        setKpis(message.data);
      } else if (message.command === "updateLogs") {
        setLogs(message.data);
      } else if (message.command === "error") {
        setError(message.message);
        setLoading(false);
      } else if (message.command === "updateStatus") {
        setConnectionStatus(message.status);
        if (message.status === "error") {
          setConnectionError(message.error);
        } else {
          setConnectionError(null);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, [vscode]);

  return {
    metrics,
    kpis,
    logs,
    loading,
    error,
    connectionStatus,
    connectionError,
  };
}
