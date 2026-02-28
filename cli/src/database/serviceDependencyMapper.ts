/**
 * VITALS Service Dependency Mapper
 * 
 * Automatically discovers and maps service dependencies from:
 * - Distributed traces (Jaeger, OpenTelemetry)
 * - Logs (service-to-service calls)
 * - Metrics (interconnected services)
 * - Network topology
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);

/**
 * Service node in the dependency graph
 */
export interface ServiceNode {
  id: string;
  name: string;
  type: 'service' | 'database' | 'cache' | 'queue' | 'external';
  environment: string;
  metadata?: {
    version?: string;
    namespace?: string;
    cluster?: string;
    team?: string;
    repository?: string;
  };
}

/**
 * Dependency edge between services
 */
export interface ServiceDependency {
  id: string;
  from_service: string;  // Service ID
  to_service: string;    // Service ID
  type: 'sync' | 'async' | 'database' | 'cache' | 'queue';
  protocol?: string;  // HTTP, gRPC, AMQP, etc.
  
  // Traffic data
  request_count: number;
  error_count: number;
  error_rate: number;
  avg_latency_ms: number;
  p99_latency_ms: number;
  
  // Dependency health
  health_score: number;  // 0-100
  criticality: 'critical' | 'high' | 'medium' | 'low';
  
  // Metadata
  first_seen: Date;
  last_seen: Date;
  updated_at: Date;
}

/**
 * Service dependency map
 */
export interface ServiceMap {
  services: ServiceNode[];
  dependencies: ServiceDependency[];
  generated_at: Date;
}

/**
 * Dependency path between services
 */
export interface DependencyPath {
  from_service: string;
  to_service: string;
  path: string[];  // List of service IDs
  total_latency_ms: number;
  bottleneck_service?: string;
  critical_path: boolean;
}

/**
 * Service impact analysis
 */
export interface ServiceImpact {
  service_id: string;
  service_name: string;
  
  // Downstream impact (services that depend on this)
  downstream_services: string[];
  downstream_count: number;
  blast_radius: number;  // Number of services affected if this fails
  
  // Upstream dependencies (services this depends on)
  upstream_services: string[];
  upstream_count: number;
  
  // Risk assessment
  single_point_of_failure: boolean;
  criticality_score: number;  // 0-100
}

/**
 * Trace span for dependency extraction
 */
export interface TraceSpan {
  span_id: string;
  parent_span_id?: string;
  service_name: string;
  operation: string;
  start_time: number;
  duration_ms: number;
  tags?: Record<string, any>;
  logs?: Array<{ timestamp: number; fields: Record<string, any> }>;
}

/**
 * Service Dependency Mapper
 */
export class ServiceDependencyMapper {
  private basePath: string;
  private services: Map<string, ServiceNode>;
  private dependencies: Map<string, ServiceDependency>;
  private loaded: boolean = false;

  constructor(basePath: string = '~/.vitals/service-dependencies') {
    // Expand home directory
    if (basePath.startsWith('~')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      basePath = path.join(homeDir, basePath.slice(2));
    }
    
    this.basePath = basePath;
    this.services = new Map();
    this.dependencies = new Map();
  }

  /**
   * Initialize the mapper
   */
  async initialize(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
    await this.load();
    this.loaded = true;
  }

  /**
   * Add or update a service
   */
  async upsertService(service: ServiceNode): Promise<void> {
    await this.ensureLoaded();
    this.services.set(service.id, service);
    await this.save();
  }

  /**
   * Add or update a dependency
   */
  async upsertDependency(dependency: ServiceDependency): Promise<void> {
    await this.ensureLoaded();
    
    const existing = this.dependencies.get(dependency.id);
    
    if (existing) {
      // Update existing dependency
      dependency.first_seen = existing.first_seen;
      dependency.updated_at = new Date();
    } else {
      dependency.first_seen = new Date();
      dependency.last_seen = new Date();
      dependency.updated_at = new Date();
    }
    
    // Calculate health score
    dependency.health_score = this.calculateHealthScore(dependency);
    
    this.dependencies.set(dependency.id, dependency);
    await this.save();
  }

  /**
   * Extract dependencies from distributed traces
   */
  async extractFromTraces(traces: TraceSpan[][]): Promise<void> {
    await this.ensureLoaded();
    
    for (const trace of traces) {
      // Build span tree
      const spanMap = new Map<string, TraceSpan>();
      const childrenMap = new Map<string, TraceSpan[]>();
      
      for (const span of trace) {
        spanMap.set(span.span_id, span);
        
        if (span.parent_span_id) {
          if (!childrenMap.has(span.parent_span_id)) {
            childrenMap.set(span.parent_span_id, []);
          }
          childrenMap.get(span.parent_span_id)!.push(span);
        }
      }
      
      // Extract dependencies from parent-child relationships
      for (const span of trace) {
        // Add service if not exists
        const serviceId = this.getServiceId(span.service_name);
        if (!this.services.has(serviceId)) {
          await this.upsertService({
            id: serviceId,
            name: span.service_name,
            type: 'service',
            environment: 'unknown'
          });
        }
        
        // Check for dependencies
        if (span.parent_span_id) {
          const parentSpan = spanMap.get(span.parent_span_id);
          if (parentSpan && parentSpan.service_name !== span.service_name) {
            // Found a cross-service call
            const fromServiceId = this.getServiceId(parentSpan.service_name);
            const toServiceId = this.getServiceId(span.service_name);
            const depId = `${fromServiceId}-${toServiceId}`;
            
            const existing = this.dependencies.get(depId);
            
            await this.upsertDependency({
              id: depId,
              from_service: fromServiceId,
              to_service: toServiceId,
              type: 'sync',
              protocol: span.tags?.['http.method'] ? 'HTTP' : span.tags?.['rpc.system'] || 'unknown',
              request_count: (existing?.request_count || 0) + 1,
              error_count: existing?.error_count || 0,
              error_rate: existing?.error_rate || 0,
              avg_latency_ms: existing ? 
                (existing.avg_latency_ms * existing.request_count + span.duration_ms) / (existing.request_count + 1) :
                span.duration_ms,
              p99_latency_ms: Math.max(existing?.p99_latency_ms || 0, span.duration_ms),
              health_score: 100,
              criticality: 'medium',
              first_seen: existing?.first_seen || new Date(),
              last_seen: new Date(),
              updated_at: new Date()
            });
          }
        }
      }
    }
    
    await this.save();
  }

  /**
   * Get the complete service map
   */
  async getServiceMap(): Promise<ServiceMap> {
    await this.ensureLoaded();
    
    return {
      services: Array.from(this.services.values()),
      dependencies: Array.from(this.dependencies.values()),
      generated_at: new Date()
    };
  }

  /**
   * Get dependencies for a specific service
   */
  async getServiceDependencies(serviceId: string): Promise<{
    outgoing: ServiceDependency[];
    incoming: ServiceDependency[];
  }> {
    await this.ensureLoaded();
    
    const outgoing = Array.from(this.dependencies.values())
      .filter(dep => dep.from_service === serviceId);
    
    const incoming = Array.from(this.dependencies.values())
      .filter(dep => dep.to_service === serviceId);
    
    return { outgoing, incoming };
  }

  /**
   * Find critical path between two services
   */
  async findCriticalPath(fromServiceId: string, toServiceId: string): Promise<DependencyPath | null> {
    await this.ensureLoaded();
    
    if (!this.services.has(fromServiceId) || !this.services.has(toServiceId)) {
      return null;
    }
    
    // BFS to find path
    const queue: Array<{ serviceId: string; path: string[]; latency: number }> = [
      { serviceId: fromServiceId, path: [fromServiceId], latency: 0 }
    ];
    const visited = new Set<string>([fromServiceId]);
    
    while (queue.length > 0) {
      const { serviceId, path, latency } = queue.shift()!;
      
      if (serviceId === toServiceId) {
        // Found path
        const bottleneck = this.findBottleneck(path);
        
        return {
          from_service: fromServiceId,
          to_service: toServiceId,
          path,
          total_latency_ms: latency,
          bottleneck_service: bottleneck,
          critical_path: true
        };
      }
      
      // Find outgoing dependencies
      const outgoing = Array.from(this.dependencies.values())
        .filter(dep => dep.from_service === serviceId);
      
      for (const dep of outgoing) {
        if (!visited.has(dep.to_service)) {
          visited.add(dep.to_service);
          queue.push({
            serviceId: dep.to_service,
            path: [...path, dep.to_service],
            latency: latency + dep.avg_latency_ms
          });
        }
      }
    }
    
    return null;
  }

  /**
   * Analyze service impact (blast radius)
   */
  async analyzeServiceImpact(serviceId: string): Promise<ServiceImpact> {
    await this.ensureLoaded();
    
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }
    
    // Find downstream services (services that depend on this one)
    const downstreamDirect = Array.from(this.dependencies.values())
      .filter(dep => dep.to_service === serviceId)
      .map(dep => dep.from_service);
    
    const downstreamAll = await this.findAllDownstream(serviceId);
    
    // Find upstream services (services this one depends on)
    const upstreamDirect = Array.from(this.dependencies.values())
      .filter(dep => dep.from_service === serviceId)
      .map(dep => dep.to_service);
    
    const upstreamAll = await this.findAllUpstream(serviceId);
    
    // Check if single point of failure
    const isSPOF = downstreamAll.size > 5;  // Arbitrary threshold
    
    // Calculate criticality score
    const criticalityScore = this.calculateCriticalityScore(
      downstreamAll.size,
      upstreamAll.size,
      serviceId
    );
    
    return {
      service_id: serviceId,
      service_name: service.name,
      downstream_services: Array.from(downstreamAll),
      downstream_count: downstreamAll.size,
      blast_radius: downstreamAll.size,
      upstream_services: Array.from(upstreamAll),
      upstream_count: upstreamAll.size,
      single_point_of_failure: isSPOF,
      criticality_score: criticalityScore
    };
  }

  /**
   * Find circular dependencies
   */
  async findCircularDependencies(): Promise<string[][]> {
    await this.ensureLoaded();
    
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (serviceId: string, path: string[]): void => {
      visited.add(serviceId);
      recursionStack.add(serviceId);
      path.push(serviceId);
      
      // Get outgoing dependencies
      const outgoing = Array.from(this.dependencies.values())
        .filter(dep => dep.from_service === serviceId);
      
      for (const dep of outgoing) {
        if (!visited.has(dep.to_service)) {
          dfs(dep.to_service, [...path]);
        } else if (recursionStack.has(dep.to_service)) {
          // Found a cycle
          const cycleStart = path.indexOf(dep.to_service);
          const cycle = path.slice(cycleStart);
          cycle.push(dep.to_service);
          cycles.push(cycle);
        }
      }
      
      recursionStack.delete(serviceId);
    };
    
    for (const serviceId of this.services.keys()) {
      if (!visited.has(serviceId)) {
        dfs(serviceId, []);
      }
    }
    
    return cycles;
  }

  /**
   * Get service health summary
   */
  async getServiceHealthSummary(serviceId: string): Promise<{
    service_id: string;
    overall_health: number;
    unhealthy_dependencies: ServiceDependency[];
    recommendations: string[];
  }> {
    await this.ensureLoaded();
    
    const { outgoing, incoming } = await this.getServiceDependencies(serviceId);
    const allDeps = [...outgoing, ...incoming];
    
    const unhealthyDeps = allDeps.filter(dep => dep.health_score < 70);
    const avgHealth = allDeps.length > 0 ?
      allDeps.reduce((sum, dep) => sum + dep.health_score, 0) / allDeps.length :
      100;
    
    const recommendations: string[] = [];
    
    if (unhealthyDeps.length > 0) {
      recommendations.push(`${unhealthyDeps.length} unhealthy dependencies detected`);
    }
    
    const highErrorDeps = allDeps.filter(dep => dep.error_rate > 0.05);
    if (highErrorDeps.length > 0) {
      recommendations.push(`High error rate on ${highErrorDeps.length} dependencies`);
    }
    
    const slowDeps = allDeps.filter(dep => dep.avg_latency_ms > 1000);
    if (slowDeps.length > 0) {
      recommendations.push(`Slow response time on ${slowDeps.length} dependencies`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All dependencies healthy');
    }
    
    return {
      service_id: serviceId,
      overall_health: Math.round(avgHealth),
      unhealthy_dependencies: unhealthyDeps,
      recommendations
    };
  }

  // Private helper methods

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.initialize();
    }
  }

  private getServiceId(serviceName: string): string {
    return serviceName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  private calculateHealthScore(dependency: ServiceDependency): number {
    let score = 100;
    
    // Penalize for high error rate
    score -= dependency.error_rate * 50;
    
    // Penalize for high latency
    if (dependency.avg_latency_ms > 1000) {
      score -= 20;
    } else if (dependency.avg_latency_ms > 500) {
      score -= 10;
    }
    
    // Penalize for very high p99 latency
    if (dependency.p99_latency_ms > 5000) {
      score -= 15;
    }
    
    return Math.max(0, Math.round(score));
  }

  private findBottleneck(servicePath: string[]): string | undefined {
    let maxLatency = 0;
    let bottleneck: string | undefined;
    
    for (let i = 0; i < servicePath.length - 1; i++) {
      const depId = `${servicePath[i]}-${servicePath[i + 1]}`;
      const dep = this.dependencies.get(depId);
      
      if (dep && dep.avg_latency_ms > maxLatency) {
        maxLatency = dep.avg_latency_ms;
        bottleneck = servicePath[i + 1];
      }
    }
    
    return bottleneck;
  }

  private async findAllDownstream(serviceId: string): Promise<Set<string>> {
    const downstream = new Set<string>();
    const queue = [serviceId];
    const visited = new Set<string>([serviceId]);
    
    while (queue.length > 0) {
      const currentService = queue.shift()!;
      
      const deps = Array.from(this.dependencies.values())
        .filter(dep => dep.to_service === currentService);
      
      for (const dep of deps) {
        if (!visited.has(dep.from_service)) {
          visited.add(dep.from_service);
          downstream.add(dep.from_service);
          queue.push(dep.from_service);
        }
      }
    }
    
    return downstream;
  }

  private async findAllUpstream(serviceId: string): Promise<Set<string>> {
    const upstream = new Set<string>();
    const queue = [serviceId];
    const visited = new Set<string>([serviceId]);
    
    while (queue.length > 0) {
      const currentService = queue.shift()!;
      
      const deps = Array.from(this.dependencies.values())
        .filter(dep => dep.from_service === currentService);
      
      for (const dep of deps) {
        if (!visited.has(dep.to_service)) {
          visited.add(dep.to_service);
          upstream.add(dep.to_service);
          queue.push(dep.to_service);
        }
      }
    }
    
    return upstream;
  }

  private calculateCriticalityScore(
    downstreamCount: number,
    upstreamCount: number,
    serviceId: string
  ): number {
    let score = 0;
    
    // More downstream services = higher criticality
    score += Math.min(50, downstreamCount * 5);
    
    // More upstream dependencies = lower reliability
    score += Math.min(30, upstreamCount * 3);
    
    // Check if service has critical dependencies
    const deps = Array.from(this.dependencies.values())
      .filter(dep => dep.from_service === serviceId);
    
    const criticalDeps = deps.filter(dep => dep.criticality === 'critical').length;
    score += criticalDeps * 10;
    
    return Math.min(100, Math.round(score));
  }

  private async load(): Promise<void> {
    const servicesPath = path.join(this.basePath, 'services.json');
    const dependenciesPath = path.join(this.basePath, 'dependencies.json');
    
    try {
      // Load services
      const servicesData = await readFile(servicesPath, 'utf8');
      const services = JSON.parse(servicesData) as ServiceNode[];
      
      this.services.clear();
      for (const service of services) {
        this.services.set(service.id, service);
      }
      
      // Load dependencies
      const depsData = await readFile(dependenciesPath, 'utf8');
      const dependencies = JSON.parse(depsData) as ServiceDependency[];
      
      this.dependencies.clear();
      for (const dep of dependencies) {
        dep.first_seen = new Date(dep.first_seen);
        dep.last_seen = new Date(dep.last_seen);
        dep.updated_at = new Date(dep.updated_at);
        this.dependencies.set(dep.id, dep);
      }
    } catch (error) {
      // Files don't exist yet, start fresh
    }
  }

  private async save(): Promise<void> {
    const servicesPath = path.join(this.basePath, 'services.json');
    const dependenciesPath = path.join(this.basePath, 'dependencies.json');
    
    const services = Array.from(this.services.values());
    const dependencies = Array.from(this.dependencies.values());
    
    await writeFile(servicesPath, JSON.stringify(services, null, 2), 'utf8');
    await writeFile(dependenciesPath, JSON.stringify(dependencies, null, 2), 'utf8');
  }
}

/**
 * Helper to visualize service map as DOT format (Graphviz)
 */
export function exportToDot(serviceMap: ServiceMap): string {
  const lines: string[] = [];
  
  lines.push('digraph ServiceDependencies {');
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=box, style=rounded];');
  lines.push('');
  
  // Add nodes
  for (const service of serviceMap.services) {
    const color = service.type === 'service' ? 'lightblue' :
                  service.type === 'database' ? 'lightgreen' :
                  service.type === 'cache' ? 'lightyellow' : 'lightgray';
    
    lines.push(`  "${service.name}" [fillcolor=${color}, style="rounded,filled"];`);
  }
  
  lines.push('');
  
  // Add edges
  for (const dep of serviceMap.dependencies) {
    const fromService = serviceMap.services.find(s => s.id === dep.from_service);
    const toService = serviceMap.services.find(s => s.id === dep.to_service);
    
    if (fromService && toService) {
      const color = dep.health_score > 80 ? 'green' :
                    dep.health_score > 50 ? 'orange' : 'red';
      const style = dep.type === 'async' ? 'dashed' : 'solid';
      
      lines.push(`  "${fromService.name}" -> "${toService.name}" [color=${color}, style=${style}, label="${dep.avg_latency_ms.toFixed(0)}ms"];`);
    }
  }
  
  lines.push('}');
  
  return lines.join('\n');
}
