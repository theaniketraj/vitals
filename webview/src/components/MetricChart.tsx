import * as React from "react";
import * as Plot from "@observablehq/plot";

// Component to render metric charts
interface MetricChartProps {
  metrics: any;
  loading?: boolean;
  error?: string | null;
}

const MetricChart: React.FC<MetricChartProps> = ({
  metrics,
  loading,
  error,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState<number>(0);

  // Handle resize
  React.useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setWidth(entry.contentRect.width);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  React.useEffect(() => {
    if (loading || error || !metrics?.data?.result || width === 0) {
      if (ref.current) ref.current.innerHTML = ""; // Clear chart
      return;
    }

    let plot: HTMLElement | SVGSVGElement | null = null;
    if (ref.current && metrics?.data?.result) {
      const data = metrics.data.result.flatMap((r: any) =>
        r.values
          ? r.values.map((v: any) => ({
              time: new Date(v[0] * 1000),
              value: Number.parseFloat(v[1]),
              metric: r.metric,
            }))
          : [
              {
                time: new Date(r.value[0] * 1000),
                value: Number.parseFloat(r.value[1]),
                metric: r.metric,
              },
            ],
      );

      // Calculate interval for bar width
      // Default to 5 seconds to avoid giant blocks when only a single data point exists
      let barWidthMs = 5000;

      if (data.length > 1) {
        const times = data
          .map((d: any) => d.time.getTime())
          .sort((a: number, b: number) => a - b);
        let minDiff = Infinity;
        for (let i = 1; i < times.length; i++) {
          const diff = times[i] - times[i - 1];
          if (diff < minDiff && diff > 0) minDiff = diff;
        }
        if (minDiff !== Infinity) barWidthMs = minDiff;
      }

      // Use 90% of the interval for the bar width to leave a small gap
      const widthMs = barWidthMs * 0.9;

      // Ensure minimum x-axis span of 1 minute to prevent single bars from filling the chart
      const times = data.map((d: any) => d.time.getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      let domainMin = minTime;
      let domainMax = maxTime;

      // If we have data, ensure at least 1 minute span
      if (data.length > 0) {
        const minSpan = 60 * 1000; // 1 minute
        const currentSpan = maxTime - minTime;
        if (currentSpan < minSpan) {
          const padding = (minSpan - currentSpan) / 2;
          domainMin -= padding;
          domainMax += padding;
        }
        // Also ensure we have enough room for the bar width at the edges
        domainMin = Math.min(domainMin, minTime - widthMs);
        domainMax = Math.max(domainMax, maxTime + widthMs);
      }

      // Clear previous chart
      ref.current.innerHTML = "";

      plot = Plot.plot({
        marks: [
          Plot.rectY(data, {
            x1: (d: any) => new Date(d.time.getTime() - widthMs / 2),
            x2: (d: any) => new Date(d.time.getTime() + widthMs / 2),
            y: "value",
            fill: "var(---primary)",
            tip: true,
            title: (d: any) => {
              const metricName = d.metric
                ? Object.values(d.metric).map(String).join(" ")
                : "Request Rate";
              return `${metricName}\nTime: ${d.time.toLocaleTimeString()}\nValue: ${d.value.toFixed(4)} req/s`;
            },
          }),
          Plot.ruleY([0], { stroke: "var(--vscode-widget-border)" }),
        ],
        x: {
          label: "Time",
          tickFormat: "%H:%M:%S",
          ticks: width / 80,
          grid: false,
          domain:
            data.length > 0
              ? [new Date(domainMin), new Date(domainMax)]
              : undefined,
          inset: 6,
        },
        y: {
          label: "Request Rate (req/s)",
          grid: true,
        },
        width: width,
        height: 350,
        marginTop: 20,
        marginBottom: 30,
        marginLeft: 40,
        marginRight: 20,
        style: {
          background: "transparent",
          color: "var(--vscode-editor-foreground)",
          fontSize: "11px",
          fontFamily: "var(--vscode-font-family)",
          overflow: "visible",
        },
      });

      ref.current.appendChild(plot);
    }
    return () => {
      if (plot && ref.current?.contains(plot)) {
        plot.remove();
      }
    };
  }, [metrics, loading, error, width]);

  return (
    <div
      ref={containerRef}
      className="metric-chart-container"
      style={{ width: "100%", height: "100%" }}
    >
      {loading && <div className="chart-status">Loading metrics...</div>}
      {error && <div className="chart-status error">Error: {error}</div>}
      {!loading && !error && !metrics && (
        <div className="chart-status">No data available</div>
      )}
      <div ref={ref} className="metric-chart" />
    </div>
  );
};

export default MetricChart;
