/**
 * VITALS Cross-Source Correlator
 * 
 * Correlates data from multiple observability sources:
 * - Metrics (Prometheus, Datadog, New Relic)
 * - Traces (Jaeger, OpenTelemetry, Zipkin)
 * - Logs (Loki, Elasticsearch, CloudWatch)
 * - Incidents (PagerDuty, Opsgenie)
 * - Regressions (VITALS database)
 * - Deployments (Git, CI/CD systems)
 */

import { RegressionDatabase, RegressionRecord } from './regressionDatabase';
import { IncidentKnowledgeGraph, GraphNode, IncidentNode } from './incidentKnowledgeGraph';
import { ServiceDependencyMapper, ServiceDependency } from './serviceDependencyMapper';

/**
 * Data source types
 */
export type DataSourceType = 
  | 'metrics'
  | 'traces'
  | 'logs'
  | 'incidents'
  | 'regressions'
  | 'deployments'
  | 'alerts';

/**
 * Correlation event (unified representation)
 */
export interface CorrelationEvent {
  id: string;
  timestamp: Date;
  source: DataSourceType;
  type: string;  // e.g., 'regression', 'incident', 'deployment', 'spike'
  service: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  
  // Event-specific data
  data: Record<string, any>;
  
  // Relationships to other events
  related_events?: string[];  // Event IDs
  correlation_score?: number;  // 0-1
  
  // Analysis
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Time window for correlation analysis
 */
export interface TimeWindow {
  start: Date;
  end: Date;
}

/**
 * Correlation result
 */
export interface CorrelationResult {
  primary_event: CorrelationEvent;
  correlated_events: Array<{
    event: CorrelationEvent;
    correlation_score: number;
    correlation_type: 'temporal' | 'causal' | 'service' | 'metric';
    explanation: string;
  }>;
  timeline: CorrelationEvent[];  // Events sorted by time
  affected_services: string[];
  likely_root_cause?: string;
  recommendations: string[];
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetection {
  timestamp: Date;
  service: string;
  metric?: string;
  anomaly_type: 'spike' | 'drop' | 'missing' | 'error_rate';
  severity: 'critical' | 'high' | 'medium' | 'low';
  baseline_value: number;
  actual_value: number;
  deviation_percent: number;
  confidence: number;  // 0-1
}

/**
 * Cross-source correlation query
 */
export interface CorrelationQuery {
  // Time range
  start_time: Date;
  end_time: Date;
  
  // Filters
  services?: string[];
  source_types?: DataSourceType[];
  severity?: ('critical' | 'high' | 'medium' | 'low' | 'info')[];
  
  // Correlation parameters
  time_window_minutes?: number;  // How close events must be to correlate
  min_correlation_score?: number;  // Minimum correlation strength
  
  // Limits
  max_results?: number;
}

/**
 * Cross-Source Correlator
 */
export class CrossSourceCorrelator {
  private regressionDb: RegressionDatabase;
  private knowledgeGraph: IncidentKnowledgeGraph;
  private dependencyMapper: ServiceDependencyMapper;
  
  // Event storage
  private events: Map<string, CorrelationEvent>;
  private eventsByTime: CorrelationEvent[];
  
  constructor(
    regressionDb: RegressionDatabase,
    knowledgeGraph: IncidentKnowledgeGraph,
    dependencyMapper: ServiceDependencyMapper
  ) {
    this.regressionDb = regressionDb;
    this.knowledgeGraph = knowledgeGraph;
    this.dependencyMapper = dependencyMapper;
    this.events = new Map();
    this.eventsByTime = [];
  }

  /**
   * Initialize the correlator
   */
  async initialize(): Promise<void> {
    await this.regressionDb.initialize();
    await this.knowledgeGraph.initialize();
    await this.dependencyMapper.initialize();
    
    // Load recent events
    await this.loadRecentEvents();
  }

  /**
   * Ingest an event from any source
   */
  async ingestEvent(event: CorrelationEvent): Promise<void> {
    this.events.set(event.id, event);
    this.eventsByTime.push(event);
    
    // Keep sorted by time
    this.eventsByTime.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Auto-correlate with recent events
    await this.autoCorrelate(event);
  }

  /**
   * Correlate events for a specific incident
   */
  async correlateIncident(incidentId: string, timeWindow: TimeWindow): Promise<CorrelationResult> {
    // Get incident from knowledge graph
    const incidentNode = await this.knowledgeGraph.getNode(`incident-${incidentId}`) as IncidentNode;
    if (!incidentNode) {
      throw new Error(`Incident not found: ${incidentId}`);
    }
    
    const incidentProps = incidentNode.properties;
    const primaryEvent: CorrelationEvent = {
      id: incidentId,
      timestamp: incidentProps.started_at,
      source: 'incidents',
      type: 'incident',
      service: incidentProps.affected_services[0] || 'unknown',
      severity: incidentProps.severity,
      data: {
        title: incidentProps.title,
        status: incidentProps.status,
        affected_services: incidentProps.affected_services
      }
    };
    
    // Find events in time window
    const candidates = this.eventsByTime.filter(event => 
      event.timestamp >= timeWindow.start &&
      event.timestamp <= timeWindow.end
    );
    
    // Correlate events
    const correlatedEvents: CorrelationResult['correlated_events'] = [];
    const affectedServices = new Set<string>(incidentProps.affected_services);
    
    for (const event of candidates) {
      if (event.id === incidentId) continue;
      
      const correlation = this.calculateCorrelation(primaryEvent, event);
      
      if (correlation.score > 0.5) {
        correlatedEvents.push({
          event,
          correlation_score: correlation.score,
          correlation_type: correlation.type,
          explanation: correlation.explanation
        });
        
        if (event.service) {
          affectedServices.add(event.service);
        }
      }
    }
    
    // Sort by correlation score
    correlatedEvents.sort((a, b) => b.correlation_score - a.correlation_score);
    
    // Build timeline
    const timeline = [primaryEvent, ...correlatedEvents.map(c => c.event)]
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Determine likely root cause
    const likelyRootCause = this.determineLikelyRootCause(correlatedEvents);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(primaryEvent, correlatedEvents);
    
    return {
      primary_event: primaryEvent,
      correlated_events: correlatedEvents,
      timeline,
      affected_services: Array.from(affectedServices),
      likely_root_cause: likelyRootCause,
      recommendations
    };
  }

  /**
   * Correlate events for a specific regression
   */
  async correlateRegression(regressionId: string): Promise<CorrelationResult> {
    // Get regression from database
    const regression = await this.regressionDb.getById(regressionId);
    if (!regression) {
      throw new Error(`Regression not found: ${regressionId}`);
    }
    
    const primaryEvent: CorrelationEvent = {
      id: regressionId,
      timestamp: regression.timestamp,
      source: 'regressions',
      type: 'regression',
      service: regression.service,
      severity: regression.verdict === 'FAIL' ? 'high' : 'medium',
      data: {
        metric: regression.metric,
        verdict: regression.verdict,
        change_percent: regression.change_percent,
        p_value: regression.p_value
      }
    };
    
    // Define time window (±30 minutes)
    const timeWindow: TimeWindow = {
      start: new Date(regression.timestamp.getTime() - 30 * 60 * 1000),
      end: new Date(regression.timestamp.getTime() + 30 * 60 * 1000)
    };
    
    return await this.correlateIncident(regressionId, timeWindow);
  }

  /**
   * Find anomalies across all sources
   */
  async detectAnomalies(query: CorrelationQuery): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];
    
    // Look for metric spikes
    const events = this.eventsByTime.filter(event =>
      event.timestamp >= query.start_time &&
      event.timestamp <= query.end_time &&
      (!query.services || query.services.includes(event.service)) &&
      (!query.source_types || query.source_types.includes(event.source))
    );
    
    // Detect sudden changes
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];
      
      // Skip if different services or sources
      if (prev.service !== curr.service || prev.source !== curr.source) continue;
      
      // Check for metric changes
      if (prev.data.value !== undefined && curr.data.value !== undefined) {
        const prevValue = prev.data.value;
        const currValue = curr.data.value;
        const change = ((currValue - prevValue) / prevValue) * 100;
        
        // Detect spikes (>50% increase)
        if (change > 50) {
          anomalies.push({
            timestamp: curr.timestamp,
            service: curr.service,
            metric: curr.data.metric,
            anomaly_type: 'spike',
            severity: change > 100 ? 'critical' : 'high',
            baseline_value: prevValue,
            actual_value: currValue,
            deviation_percent: change,
            confidence: 0.8
          });
        }
        
        // Detect drops (>50% decrease)
        if (change < -50) {
          anomalies.push({
            timestamp: curr.timestamp,
            service: curr.service,
            metric: curr.data.metric,
            anomaly_type: 'drop',
            severity: 'medium',
            baseline_value: prevValue,
            actual_value: currValue,
            deviation_percent: change,
            confidence: 0.8
          });
        }
      }
    }
    
    // Detect error rate increases
    const errorEvents = events.filter(e => e.type === 'error' || e.data.error_rate > 0);
    for (const event of errorEvents) {
      if (event.data.error_rate > 0.05) {  // >5% error rate
        anomalies.push({
          timestamp: event.timestamp,
          service: event.service,
          anomaly_type: 'error_rate',
          severity: event.data.error_rate > 0.2 ? 'critical' : 'high',
          baseline_value: 0,
          actual_value: event.data.error_rate,
          deviation_percent: event.data.error_rate * 100,
          confidence: 0.9
        });
      }
    }
    
    return anomalies.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Query correlated events
   */
  async queryCorrelations(query: CorrelationQuery): Promise<CorrelationEvent[]> {
    let results = this.eventsByTime.filter(event =>
      event.timestamp >= query.start_time &&
      event.timestamp <= query.end_time
    );
    
    // Apply filters
    if (query.services && query.services.length > 0) {
      results = results.filter(e => query.services!.includes(e.service));
    }
    
    if (query.source_types && query.source_types.length > 0) {
      results = results.filter(e => query.source_types!.includes(e.source));
    }
    
    if (query.severity && query.severity.length > 0) {
      results = results.filter(e => query.severity!.includes(e.severity));
    }
    
    // Limit results
    if (query.max_results) {
      results = results.slice(0, query.max_results);
    }
    
    return results;
  }

  /**
   * Generate correlation timeline visualization
   */
  async generateTimeline(query: CorrelationQuery): Promise<{
    events: CorrelationEvent[];
    buckets: Array<{
      timestamp: Date;
      event_count: number;
      severity_distribution: Record<string, number>;
      source_distribution: Record<string, number>;
    }>;
  }> {
    const events = await this.queryCorrelations(query);
    
    // Group events into time buckets (e.g., 5-minute intervals)
    const bucketSize = 5 * 60 * 1000;  // 5 minutes in ms
    const buckets = new Map<number, CorrelationEvent[]>();
    
    for (const event of events) {
      const bucket = Math.floor(event.timestamp.getTime() / bucketSize) * bucketSize;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket)!.push(event);
    }
    
    // Calculate distributions
    const bucketResults = Array.from(buckets.entries()).map(([timestamp, bucketEvents]) => {
      const severityDist: Record<string, number> = {};
      const sourceDist: Record<string, number> = {};
      
      for (const event of bucketEvents) {
        severityDist[event.severity] = (severityDist[event.severity] || 0) + 1;
        sourceDist[event.source] = (sourceDist[event.source] || 0) + 1;
      }
      
      return {
        timestamp: new Date(timestamp),
        event_count: bucketEvents.length,
        severity_distribution: severityDist,
        source_distribution: sourceDist
      };
    });
    
    return {
      events,
      buckets: bucketResults.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    };
  }

  // Private helper methods

  private async loadRecentEvents(): Promise<void> {
    // Load recent regressions
    const recentDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);  // 7 days ago
    const regressions = await this.regressionDb.query({
      start_date: recentDate,
      sort_by: 'timestamp',
      sort_order: 'desc'
    });
    
    for (const regression of regressions) {
      const event: CorrelationEvent = {
        id: regression.id,
        timestamp: regression.timestamp,
        source: 'regressions',
        type: 'regression',
        service: regression.service,
        severity: regression.verdict === 'FAIL' ? 'high' : 'medium',
        data: {
          metric: regression.metric,
          verdict: regression.verdict,
          change_percent: regression.change_percent,
          deployment_id: regression.deployment_id
        },
        tags: regression.tags
      };
      
      this.events.set(event.id, event);
      this.eventsByTime.push(event);
    }
    
    // Sort by time
    this.eventsByTime.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private async autoCorrelate(newEvent: CorrelationEvent): Promise<void> {
    // Find events in time window (±15 minutes)
    const windowMs = 15 * 60 * 1000;
    const candidates = this.eventsByTime.filter(event =>
      event.id !== newEvent.id &&
      Math.abs(event.timestamp.getTime() - newEvent.timestamp.getTime()) < windowMs
    );
    
    const relatedEvents: string[] = [];
    
    for (const candidate of candidates) {
      const correlation = this.calculateCorrelation(newEvent, candidate);
      
      if (correlation.score > 0.6) {
        relatedEvents.push(candidate.id);
        
        // Update knowledge graph if incident-related
        if (newEvent.source === 'incidents' && candidate.source === 'regressions') {
          // Link incident to regression in knowledge graph
          try {
            await this.knowledgeGraph.addEdge({
              id: `edge-${newEvent.id}-${candidate.id}`,
              type: 'caused_by',
              from_node: candidate.id,
              to_node: newEvent.id,
              weight: correlation.score
            });
          } catch (error) {
            // Ignore if nodes don't exist yet
          }
        }
      }
    }
    
    if (relatedEvents.length > 0) {
      newEvent.related_events = relatedEvents;
    }
  }

  private calculateCorrelation(
    event1: CorrelationEvent,
    event2: CorrelationEvent
  ): {
    score: number;
    type: 'temporal' | 'causal' | 'service' | 'metric';
    explanation: string;
  } {
    let score = 0;
    let type: 'temporal' | 'causal' | 'service' | 'metric' = 'temporal';
    let explanation = '';
    
    // Temporal proximity (closer in time = higher score)
    const timeDiffMs = Math.abs(event1.timestamp.getTime() - event2.timestamp.getTime());
    const timeDiffMinutes = timeDiffMs / (60 * 1000);
    const temporalScore = Math.max(0, 1 - (timeDiffMinutes / 30));  // 30-minute window
    score += temporalScore * 0.3;
    
    // Same service
    if (event1.service === event2.service) {
      score += 0.4;
      type = 'service';
      explanation = `Both events affect service: ${event1.service}`;
    }
    
    // Service dependency
    const deps = this.dependencyMapper['dependencies'];
    if (deps) {
      const hasDependency = Array.from(deps.values()).some(
        dep => 
          (dep.from_service === event1.service && dep.to_service === event2.service) ||
          (dep.from_service === event2.service && dep.to_service === event1.service)
      );
      
      if (hasDependency) {
        score += 0.3;
        type = 'service';
        explanation = `Services have direct dependency`;
      }
    }
    
    // Causal relationships
    if (event1.source === 'deployments' && event2.source === 'regressions') {
      score += 0.5;
      type = 'causal';
      explanation = `Regression likely caused by deployment`;
    }
    
    if (event1.source === 'regressions' && event2.source === 'incidents') {
      score += 0.4;
      type = 'causal';
      explanation = `Incident likely triggered by regression`;
    }
    
    // Same metric
    if (event1.data.metric && event2.data.metric && event1.data.metric === event2.data.metric) {
      score += 0.2;
      type = 'metric';
      explanation = `Same metric affected: ${event1.data.metric}`;
    }
    
    return {
      score: Math.min(1, score),
      type,
      explanation: explanation || `Events correlated by ${type}`
    };
  }

  private determineLikelyRootCause(
    correlatedEvents: CorrelationResult['correlated_events']
  ): string | undefined {
    // Look for deployments first
    const deployment = correlatedEvents.find(c => c.event.source === 'deployments');
    if (deployment && deployment.correlation_score > 0.7) {
      return `Deployment: ${deployment.event.data.deployment_id || deployment.event.id}`;
    }
    
    // Look for regressions
    const regression = correlatedEvents.find(c => c.event.source === 'regressions');
    if (regression && regression.correlation_score > 0.7) {
      return `Performance regression: ${regression.event.data.metric}`;
    }
    
    // Look for alerts
    const alert = correlatedEvents.find(c => c.event.source === 'alerts');
    if (alert && alert.correlation_score > 0.6) {
      return `Alert triggered: ${alert.event.data.alert_name || alert.event.type}`;
    }
    
    return undefined;
  }

  private generateRecommendations(
    primaryEvent: CorrelationEvent,
    correlatedEvents: CorrelationResult['correlated_events']
  ): string[] {
    const recommendations: string[] = [];
    
    // Check for deployment correlation
    const deployment = correlatedEvents.find(c => c.event.source === 'deployments');
    if (deployment) {
      recommendations.push('Consider rolling back the recent deployment');
    }
    
    // Check for regression correlation
    const regression = correlatedEvents.find(c => c.event.source === 'regressions');
    if (regression) {
      recommendations.push(`Investigate performance regression in ${regression.event.data.metric}`);
    }
    
    // Check for multiple affected services
    const services = new Set(correlatedEvents.map(c => c.event.service));
    if (services.size > 3) {
      recommendations.push(`Multiple services affected (${services.size}). Check for infrastructure issues.`);
    }
    
    // Check for high correlation with logs
    const logs = correlatedEvents.filter(c => c.event.source === 'logs');
    if (logs.length > 0) {
      recommendations.push(`Review logs around ${primaryEvent.timestamp.toISOString()}`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring and collect more data');
    }
    
    return recommendations;
  }
}

/**
 * Helper to convert regression to correlation event
 */
export function regressionToEvent(regression: RegressionRecord): CorrelationEvent {
  return {
    id: regression.id,
    timestamp: regression.timestamp,
    source: 'regressions',
    type: 'regression',
    service: regression.service,
    severity: regression.verdict === 'FAIL' ? 'high' : 'medium',
    data: {
      metric: regression.metric,
      verdict: regression.verdict,
      change_percent: regression.change_percent,
      deployment_id: regression.deployment_id,
      commit_hash: regression.commit_hash
    },
    tags: regression.tags
  };
}

/**
 * Helper to convert incident to correlation event
 */
export function incidentToEvent(incident: IncidentNode): CorrelationEvent {
  const props = incident.properties;
  
  return {
    id: incident.id,
    timestamp: props.started_at,
    source: 'incidents',
    type: 'incident',
    service: props.affected_services[0] || 'unknown',
    severity: props.severity,
    data: {
      incident_id: props.incident_id,
      title: props.title,
      status: props.status,
      affected_services: props.affected_services,
      root_cause: props.root_cause
    }
  };
}
