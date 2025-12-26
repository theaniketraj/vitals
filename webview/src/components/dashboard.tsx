import * as React from "react";
import MetricChart from "./MetricChart";
import LogViewer from "./LogViewer";
import AlertPanel from "./AlertPanel";
import { useVitalsData } from "../hooks/useVitalsData";
import { useAlerts } from "../hooks/useAlerts";

interface DashboardProps {
  vscode: any;
}

// Main dashboard component
const Dashboard: React.FC<DashboardProps> = ({ vscode }) => {
  const { metrics, kpis: fetchedKpis, logs, loading, error, connectionStatus, connectionError } = useVitalsData(vscode);
  const {
    alerts,
    loading: alertsLoading,
    error: alertsError,
  } = useAlerts(vscode);

  const [prometheusUrl, setPrometheusUrl] = React.useState<string>('');
  const [isDemoMode, setIsDemoMode] = React.useState<boolean>(false);
  const [customMetrics, setCustomMetrics] = React.useState<any[]>([]);

  React.useEffect(() => {
    // Request Prometheus URL from extension
    vscode.postMessage({ command: 'getPrometheusUrl' });

    // Initial fetch for custom metrics
    vscode.postMessage({ command: 'fetchCustomMetrics' });

    // Listen for response
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'prometheusUrl') {
        setPrometheusUrl(message.url);
        setIsDemoMode(message.isDemoMode);
      } else if (message.command === 'updateCustomMetrics') {
        setCustomMetrics(message.data);
      }
    };

    window.addEventListener('message', messageHandler);

    // Refresh custom metrics periodically
    const intervalId = setInterval(() => {
      vscode.postMessage({ command: 'fetchCustomMetrics' });
    }, 5000); // Sync with default refresh interval

    return () => {
      window.removeEventListener('message', messageHandler);
      clearInterval(intervalId);
    };
  }, [vscode]);

  const handleConfigurePrometheus = () => {
    vscode.postMessage({ command: 'configurePrometheus' });
  };

  const handleOpenGitHub = () => {
    vscode.postMessage({ command: 'openGitHubRepo' });
  };

  const handleOpenSettings = () => {
    vscode.postMessage({ command: 'openSettings' });
  };

  // KPI data
  const kpis = [
    { label: "Request Rate", value: fetchedKpis?.requestRate || "0/s" },
    { label: "Error Rate", value: fetchedKpis?.errorRate || "0%" },
    { label: "Avg Latency", value: fetchedKpis?.avgLatency || "0ms" },
    { label: "Active Alerts", value: alerts?.length || 0 },
  ];

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <header className="dashboard-header">
        <div className="header-title">
          <h1>Vitals</h1>
        </div>
        <div className="header-actions">
          {isDemoMode && (
            <div className="demo-mode-badge" title="Using demo Prometheus with sample metrics">
              <span className="demo-icon">🎯</span>
              <span className="demo-text">Demo Mode</span>
              <button
                className="connect-btn"
                onClick={handleConfigurePrometheus}
                title="Connect to your own Prometheus instance"
              >
                Connect Prometheus
              </button>
            </div>
          )}
          <div
            className={`live-badge ${connectionStatus === 'error' ? 'error' : ''}`}
            title={connectionStatus === 'error' ? connectionError || 'Connection failed' : 'Connected to Prometheus'}
          >
            <span className="live-dot"></span>
            {connectionStatus === 'error' ? 'Network Error' : 'Live'}
          </div>
          <button className="icon-btn" onClick={handleOpenGitHub} title="View on GitHub">
            <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
          </button>
          <button className="icon-btn" onClick={handleOpenSettings} title="Open Settings">
            <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M14 8.77v-1.6l-1.94-.64-.45-1.09.88-1.84-1.13-1.13-1.81.91-1.09-.45-.69-1.92h-1.6l-.63 1.94-1.11.45-1.84-.88-1.13 1.13.91 1.81-.45 1.09L0 7.23v1.59l1.94.64.45 1.09-.88 1.84 1.13 1.13 1.81-.91 1.09.45.69 1.92h1.59l.63-1.94 1.11-.45 1.84.88 1.13-1.13-.92-1.81.47-1.09L14 8.75v.02zM8 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* KPI Section */}
        <div className="kpi-section">
          {kpis.map((kpi, index) => (
            <div key={index} className="kpi-card">
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-label">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Main Chart Area */}
        <div className="card area-chart">
          <div className="card-header">System Metrics</div>
          <div className="card-body">
            <MetricChart metrics={metrics} loading={loading} error={error} />
          </div>
        </div>

        {/* Custom Metrics Area */}
        {customMetrics.length > 0 && customMetrics.map((cm, idx) => (
          <div className="card area-chart" key={idx} style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">{cm.name}</div>
            <div className="card-body">
              <MetricChart metrics={cm.data} loading={loading} error={cm.error} />
            </div>
          </div>
        ))}

        {/* Logs Area */}
        <div className="card area-logs">
          <div className="card-header">Live Logs</div>
          <div className="card-body" style={{ padding: 0 }}>
            <LogViewer logs={logs} />
          </div>
        </div>

        {/* Alerts Area */}
        <div className="card area-alerts">
          <div className="card-header">Active Alerts</div>
          <div className="card-body">
            <AlertPanel
              alerts={alerts}
              loading={alertsLoading}
              error={alertsError}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
