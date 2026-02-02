# Advanced Distributed Tracing & Performance Profiling

## Overview

Vitals now includes comprehensive distributed tracing and performance profiling capabilities, allowing you to visualize request flow across microservices, identify performance bottlenecks, and optimize your applications with in-editor insights.

## Features

### Distributed Tracing

- **OpenTelemetry & Jaeger Integration**: Connect to your existing tracing infrastructure
- **Interactive Trace Timeline**: Visualize request flow with interactive flame graphs
- **Span-Level Detail**: Inspect tags, events, and context for each span
- **Trace Comparison**: Compare traces before/after deployments to measure improvements

### Service Dependency Maps

- **Auto-Generated Topology**: Visualize your microservices architecture automatically
- **Real-Time Traffic Flow**: See request patterns and service dependencies
- **Bottleneck Identification**: Quickly identify services causing delays
- **Health Status Overlay**: Color-coded health indicators (healthy/degraded/critical)

### Performance Profiling

- **CPU Flame Graphs**: Hierarchical visualization of function execution time
- **Database Query Analysis**: Detect slow queries and N+1 patterns
- **Network Call Waterfalls**: Visualize API call sequences and durations
- **Critical Path Analysis**: Identify the slowest chain of operations

### Code-Level Insights

- **Inline Performance Annotations**: See performance metrics directly in your editor
- **Hot Path Highlighting**: Visual indicators for code consuming most execution time
- **Automatic Optimization Suggestions**: AI-powered recommendations for improvements
- **Click-to-Trace Navigation**: Jump from annotations to related traces

## Quick Start

### 1. Configure Trace Provider

Choose your tracing backend:

```bash
Command Palette → "Vitals: Configure Trace Provider"
```

Select from:

- **Jaeger**: Open-source distributed tracing (default endpoint: `http://localhost:16686`)
- **OpenTelemetry**: Universal telemetry standard (default endpoint: `http://localhost:4318`)

### 2. Search Traces

Find traces by service, operation, or duration:

```bash
Command Palette → "Vitals: Search Traces"
```

Example searches:

- All traces for a service: Enter service name (e.g., "user-service")
- Slow operations: Select "Slow traces (>1s)" filter
- Specific endpoints: Enter operation name (e.g., "/api/users")

### 3. View Service Map

Generate a visual dependency map:

```bash
Command Palette → "Vitals: View Service Dependency Map"
```

The interactive graph shows:

- **Nodes**: Services (size = request volume, color = health)
- **Edges**: Dependencies (width = traffic volume)
- **Hover**: View detailed metrics for any service or connection

### 4. Analyze Performance

Get code-level performance insights:

```bash
Command Palette → "Vitals: Analyze Performance"
```

Enter a service name to receive:

- **Hot Functions**: Top 10 functions consuming CPU time
- **N+1 Queries**: Detected database anti-patterns
- **Inline CodeLens**: Performance metrics in your source code

## Configuration

### VS Code Settings

Access settings via: `File → Preferences → Settings → Vitals`

```json
{
// Active trace provider
"vitals.traceProvider": "jaeger",

// Trace endpoint URL
"vitals.traceEndpoint": "<http://localhost:16686>",

// Enable inline performance annotations
"vitals.enableCodeLensAnnotations": true,

// Minimum % of execution time for hot path highlighting
"vitals.performanceThreshold": 5,

// Auto-analyze traces when opening project
"vitals.enableAutoTracing": false
}
```

### Environment Setup

#### Jaeger (Recommended)

Run Jaeger all-in-one container:

```bash
docker run -d --name jaeger \\
-e COLLECTOR_ZIPKIN_HOST_PORT=:9411 \\
-p 5775:5775/udp \\
-p 6831:6831/udp \\
-p 6832:6832/udp \\
-p 5778:5778 \\
-p 16686:16686 \\
-p 14250:14250 \\
-p 14268:14268 \\
-p 14269:14269 \\
-p 9411:9411 \\
jaegertracing/all-in-one:latest
```

Access Jaeger UI: `<http://localhost:16686>`

#### OpenTelemetry Collector

Create `otel-collector-config.yaml`:

```yaml
receivers:
otlp:
protocols:
http:
endpoint: 0.0.0.0:4318
grpc:
endpoint: 0.0.0.0:4317

processors:
batch:
timeout: 10s
send_batch_size: 1024

exporters:
jaeger:
endpoint: jaeger:14250
tls:
insecure: true
logging:
loglevel: debug

service:
pipelines:
traces:
receivers: [otlp]
processors: [batch]
exporters: [jaeger, logging]
```

Run collector:

```bash
docker run -d --name otel-collector \\
-p 4317:4317 \\
-p 4318:4318 \\
-v $(pwd)/otel-collector-config.yaml:/etc/otel/config.yaml \\
otel/opentelemetry-collector:latest \\
--config /etc/otel/config.yaml
```

## Commands Reference

| Command                            | Description                    | Keyboard Shortcut |
| ---------------------------------- | ------------------------------ | ----------------- |
| **Configure Trace Provider**       | Set up Jaeger or OpenTelemetry | -                 |
| **Search Traces**                  | Find traces by criteria        | -                 |
| **View Service Dependency Map**    | Generate service topology      | -                 |
| **Analyze Performance**            | Get code-level insights        | -                 |
| **Detect Performance Regressions** | Compare baseline vs current    | -                 |

## Use Cases

### 1. Debugging Slow Requests

**Scenario**: Users report slow checkout flow

**Steps**:

1. Search traces: Service = "checkout-service", Min duration = "1s"
2. Select slowest trace → View flame graph
3. Identify bottleneck span (e.g., "inventory-check" taking 800ms)
4. Click CodeLens annotation → View suggestion (add caching)

### 2. Optimizing Database Performance

**Scenario**: High database load during peak hours

**Steps**:

1. Analyze Performance → Enter "order-service"
2. Review output: "15 N+1 query patterns detected"
3. Click inline annotation on affected code
4. Apply suggestion: "Use eager loading to reduce 15 queries to 1"

### 3. Identifying Service Dependencies

**Scenario**: Planning service migration

**Steps**:

1. View Service Dependency Map
2. Identify all services calling "legacy-auth"
3. Plan migration order (leaf nodes first)
4. Monitor health status after each migration

### 4. Measuring Deployment Impact

**Scenario**: Verify optimization reduced latency

**Steps**:

1. Detect Regressions → Enter "payment-service"
2. Review comparison: Baseline P95 = 450ms, Current P95 = 280ms
3. Confirm 38% improvement
4. Share flame graph comparison with team

## Advanced Features

### Custom Span Tags

Enrich traces with code location:

`python`

## Python with OpenTelemetry

```python
from opentelemetry import trace

tracer = trace.get_tracer(**name**)

with tracer.start_as_current_span("process_order") as span:
span.set_attribute("code.filepath", **file**)
span.set_attribute("code.lineno", 42) # Your code here
```

```javascript
// Node.js with OpenTelemetry
const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('my-service');

const span = tracer.startSpan('processOrder');
span.setAttribute('code.filepath', \_\_filename);
span.setAttribute('code.lineno', 42);
// Your code here
span.end();
```

### Memory Profiling (Experimental)

Add memory allocation tracking:

```python
with tracer.start_as_current_span("allocate_cache") as span:
span.set_attribute("memory.allocated", sys.getsizeof(cache_data))
```

### Continuous Profiling

Enable always-on profiling with low overhead:

```json
{
"vitals.enableAutoTracing": true
}
```

## Troubleshooting

### No Traces Found

**Symptoms**: Search returns 0 results

**Solutions**:

1. Verify trace provider is running:

   ```bash
   curl <http://localhost:16686/api/services>
   ```

2. Check time range (default: last 1 hour)
3. Confirm service name matches exactly (case-sensitive)
4. Verify application is instrumented with OpenTelemetry/Jaeger SDK

### CodeLens Not Showing

**Symptoms**: No inline annotations appear

**Solutions**:

1. Check setting: \`vitals.enableCodeLensAnnotations = true\`
2. Run "Analyze Performance" command first
3. Ensure spans include \`code.filepath\` and \`code.lineno\` tags
4. Reload VS Code window

### Connection Failed

**Symptoms**: "Failed to connect to [provider]"

**Solutions**:

1. Verify endpoint URL is correct
2. Check firewall/network rules
3. Test connection:

   ```bash

   # Jaeger

   curl <http://localhost:16686/api/services>

   # OpenTelemetry

   curl <http://localhost:4318/v1/traces>
   ```

4. Review provider logs for authentication errors

### Slow Visualization

**Symptoms**: Service map/flame graph loads slowly

**Solutions**:

1. Reduce time range (default: 1 hour → 15 minutes)
2. Limit trace search results (use filters)
3. Use service-specific queries instead of global searches

## Integration Examples

### Example 1: Python Flask Application

```python
from flask import Flask
from opentelemetry import trace
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter

app = Flask(**name**)

## Configure tracing

trace.set_tracer_provider(TracerProvider())
jaeger_exporter = JaegerExporter(
agent_host_name="localhost",
agent_port=6831,
)
trace.get_tracer_provider().add_span_processor(
BatchSpanProcessor(jaeger_exporter)
)

## Auto-instrument Flask

FlaskInstrumentor().instrument_app(app)
```

```javascript
@app.route('/api/users')
def get_users():
tracer = trace.get_tracer(**name**)

    with tracer.start_as_current_span("get_users") as span:
        span.set_attribute("code.filepath", __file__)
        span.set_attribute("code.lineno", 25)

        # Your business logic
        users = fetch_users_from_db()

        span.set_attribute("db.rows_returned", len(users))
        return users

```

### Example 2: Node.js Express Application

```javascript
const express = require('express');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

const app = express();

// Configure tracing
const provider = new NodeTracerProvider();
const exporter = new JaegerExporter({
endpoint: '<http://localhost:14268/api/traces>',
});

provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

registerInstrumentations({
instrumentations: [
new HttpInstrumentation(),
new ExpressInstrumentation(),
],
});

app.get('/api/orders', (req, res) => {
const { trace, context } = require('@opentelemetry/api');
const span = trace.getSpan(context.active());

span?.setAttribute('code.filepath', \_\_filename);
span?.setAttribute('code.lineno', 35);

// Your business logic
const orders = fetchOrders();
res.json(orders);
});
```

## Performance Impact

The tracing feature has minimal impact on your development workflow:

- **CodeLens rendering**: <5ms per file
- **Trace search**: Network-dependent (typically <500ms)
- **Flame graph generation**: <100ms for traces with <1000 spans
- **Service map rendering**: <200ms for <50 services

## Best Practices

1. **Tag Enrichment**: Always add \`code.filepath\` and \`code.lineno\` for CodeLens integration
2. **Sampling**: Use sampling in production (e.g., 1% of requests) to reduce overhead
3. **Service Naming**: Use consistent service names across your infrastructure
4. **Regular Analysis**: Run performance analysis weekly to catch regressions early
5. **Baseline Establishment**: Store baseline metrics after each deployment for comparison

## Roadmap

### Phase 2 (Recommended)

1. **Real-time Trace Streaming**: WebSocket connection for live updates
2. **AI-Powered Root Cause Analysis**: GPT-4 integration for automated diagnostics
3. **Historical Trends**: Store and visualize performance over weeks/months
4. **Custom Alerting**: Define thresholds for automated notifications
5. **Trace Sampling Configuration**: UI for sampling rate adjustment
6. **Integration with APM platforms**: Datadog, New Relic

### Phase 3 (Advanced)

1. **Multi-Language Profilers**: Native Python/Node.js memory profilers
2. **Distributed Transaction Tracing**: Correlate traces across message queues
3. **Cost Attribution**: Link traces to cloud resource costs
4. **Team Collaboration**: Share traces and annotations with team
5. **Custom Visualizations**: User-defined D3 templates

## Support

- **Documentation**: [Full Guide](https://theaniketraj.github.io/vitals/)
- **Issues**: [GitHub Issues](https://github.com/theaniketraj/vitals/issues)
- **Discussions**: [GitHub Discussions](https://github.com/theaniketraj/vitals/discussions)
