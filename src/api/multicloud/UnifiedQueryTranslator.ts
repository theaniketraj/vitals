import { UnifiedQuery, QueryFilter, AggregationType } from './ICloudProvider';

/**
 * Translates unified query language to platform-specific formats
 */
export class UnifiedQueryTranslator {
  /**
   * Translate to Prometheus PromQL
   */
  public toPrometheus(query: UnifiedQuery): string {
    let promql = query.metric;

    // Add filters
    if (query.filters && query.filters.length > 0) {
      const filterStr = query.filters
        .map(f => this.filterToPromQL(f))
        .join(',');
      promql = `${promql}{${filterStr}}`;
    }

    // Add aggregation
    if (query.aggregation) {
      const aggFunc = this.mapAggregationToPromQL(query.aggregation);
      
      if (query.groupBy && query.groupBy.length > 0) {
        promql = `${aggFunc} by(${query.groupBy.join(',')}) (${promql})`;
      } else {
        promql = `${aggFunc}(${promql})`;
      }
    }

    return promql;
  }

  /**
   * Translate to Datadog query language
   */
  public toDatadog(query: UnifiedQuery): string {
    let ddQuery = query.metric;

    // Add filters
    if (query.filters && query.filters.length > 0) {
      const filterStr = query.filters
        .map(f => this.filterToDatadog(f))
        .join(',');
      ddQuery = `${ddQuery}{${filterStr}}`;
    }

    // Add aggregation
    if (query.aggregation) {
      const aggFunc = this.mapAggregationToDatadog(query.aggregation);
      
      if (query.groupBy && query.groupBy.length > 0) {
        ddQuery = `${aggFunc}:${ddQuery} by {${query.groupBy.join(',')}}`;
      } else {
        ddQuery = `${aggFunc}:${ddQuery}`;
      }
    }

    return ddQuery;
  }

  /**
   * Translate to New Relic NRQL
   */
  public toNewRelic(query: UnifiedQuery): string {
    const aggFunc = query.aggregation 
      ? this.mapAggregationToNRQL(query.aggregation)
      : 'SELECT *';
    
    let nrql = `${aggFunc} FROM ${query.metric}`;

    // Add filters (WHERE clause)
    if (query.filters && query.filters.length > 0) {
      const filterStr = query.filters
        .map(f => this.filterToNRQL(f))
        .join(' AND ');
      nrql += ` WHERE ${filterStr}`;
    }

    // Add grouping (FACET clause)
    if (query.groupBy && query.groupBy.length > 0) {
      nrql += ` FACET ${query.groupBy.join(', ')}`;
    }

    return nrql;
  }

  /**
   * Translate to CloudWatch query format
   */
  public toCloudWatch(query: UnifiedQuery): string {
    // CloudWatch uses a different format: Namespace:MetricName{Dimension=Value}
    let cwQuery = query.metric;

    if (query.filters && query.filters.length > 0) {
      const dimensions = query.filters
        .filter(f => f.operator === 'eq')
        .map(f => `${f.field}=${f.value}`)
        .join(',');
      
      if (dimensions) {
        cwQuery += `{${dimensions}}`;
      }
    }

    return cwQuery;
  }

  /**
   * Translate to Azure Monitor KQL
   */
  public toAzureMonitor(query: UnifiedQuery): string {
    let kql = query.metric;

    // Add filters (where clause)
    if (query.filters && query.filters.length > 0) {
      const filterStr = query.filters
        .map(f => this.filterToKQL(f))
        .join(' and ');
      kql += `\n| where ${filterStr}`;
    }

    // Add aggregation
    if (query.aggregation) {
      const aggFunc = this.mapAggregationToKQL(query.aggregation);
      
      if (query.groupBy && query.groupBy.length > 0) {
        kql += `\n| summarize ${aggFunc} by ${query.groupBy.join(', ')}`;
      } else {
        kql += `\n| summarize ${aggFunc}`;
      }
    }

    return kql;
  }

  /**
   * Translate to Loki LogQL
   */
  public toLoki(query: UnifiedQuery): string {
    let logql = `{${query.metric}}`;

    // Add filters as label matchers
    if (query.filters && query.filters.length > 0) {
      const filterStr = query.filters
        .map(f => this.filterToLogQL(f))
        .join(',');
      logql = `{${query.metric},${filterStr}}`;
    }

    // Add aggregation
    if (query.aggregation) {
      const aggFunc = this.mapAggregationToLogQL(query.aggregation);
      logql = `${aggFunc}(${logql})`;
      
      if (query.groupBy && query.groupBy.length > 0) {
        logql = `${aggFunc} by(${query.groupBy.join(',')}) (${logql})`;
      }
    }

    return logql;
  }

  /**
   * Translate to Splunk SPL
   */
  public toSplunk(query: UnifiedQuery): string {
    let spl = `search ${query.metric}`;

    // Add filters
    if (query.filters && query.filters.length > 0) {
      const filterStr = query.filters
        .map(f => this.filterToSPL(f))
        .join(' ');
      spl += ` ${filterStr}`;
    }

    // Add aggregation
    if (query.aggregation) {
      const aggFunc = this.mapAggregationToSPL(query.aggregation);
      
      if (query.groupBy && query.groupBy.length > 0) {
        spl += ` | stats ${aggFunc} by ${query.groupBy.join(', ')}`;
      } else {
        spl += ` | stats ${aggFunc}`;
      }
    }

    return spl;
  }

  // Filter conversion helpers

  private filterToPromQL(filter: QueryFilter): string {
    switch (filter.operator) {
      case 'eq':
        return `${filter.field}="${filter.value}"`;
      case 'ne':
        return `${filter.field}!="${filter.value}"`;
      case 'regex':
        return `${filter.field}=~"${filter.value}"`;
      case 'in':
        return `${filter.field}=~"${Array.isArray(filter.value) ? filter.value.join('|') : filter.value}"`;
      default:
        return `${filter.field}="${filter.value}"`;
    }
  }

  private filterToDatadog(filter: QueryFilter): string {
    return `${filter.field}:${filter.value}`;
  }

  private filterToNRQL(filter: QueryFilter): string {
    switch (filter.operator) {
      case 'eq':
        return `${filter.field} = '${filter.value}'`;
      case 'ne':
        return `${filter.field} != '${filter.value}'`;
      case 'gt':
        return `${filter.field} > ${filter.value}`;
      case 'lt':
        return `${filter.field} < ${filter.value}`;
      case 'in':
        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
        return `${filter.field} IN (${values.map(v => `'${v}'`).join(', ')})`;
      case 'regex':
        return `${filter.field} LIKE '${filter.value}'`;
      default:
        return `${filter.field} = '${filter.value}'`;
    }
  }

  private filterToKQL(filter: QueryFilter): string {
    switch (filter.operator) {
      case 'eq':
        return `${filter.field} == "${filter.value}"`;
      case 'ne':
        return `${filter.field} != "${filter.value}"`;
      case 'gt':
        return `${filter.field} > ${filter.value}`;
      case 'lt':
        return `${filter.field} < ${filter.value}`;
      case 'in':
        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
        return `${filter.field} in (${values.map(v => `"${v}"`).join(', ')})`;
      case 'regex':
        return `${filter.field} matches regex "${filter.value}"`;
      default:
        return `${filter.field} == "${filter.value}"`;
    }
  }

  private filterToLogQL(filter: QueryFilter): string {
    return this.filterToPromQL(filter);
  }

  private filterToSPL(filter: QueryFilter): string {
    switch (filter.operator) {
      case 'eq':
        return `${filter.field}="${filter.value}"`;
      case 'ne':
        return `${filter.field}!="${filter.value}"`;
      case 'gt':
        return `${filter.field}>${filter.value}`;
      case 'lt':
        return `${filter.field}<${filter.value}`;
      default:
        return `${filter.field}="${filter.value}"`;
    }
  }

  // Aggregation mapping helpers

  private mapAggregationToPromQL(agg: AggregationType): string {
    const mapping: Record<string, string> = {
      avg: 'avg',
      sum: 'sum',
      min: 'min',
      max: 'max',
      count: 'count',
      rate: 'rate',
    };
    return mapping[agg] || 'avg';
  }

  private mapAggregationToDatadog(agg: AggregationType): string {
    const mapping: Record<string, string> = {
      avg: 'avg',
      sum: 'sum',
      min: 'min',
      max: 'max',
      count: 'count',
    };
    return mapping[agg] || 'avg';
  }

  private mapAggregationToNRQL(agg: AggregationType): string {
    const mapping: Record<string, string> = {
      avg: 'SELECT average(value)',
      sum: 'SELECT sum(value)',
      min: 'SELECT min(value)',
      max: 'SELECT max(value)',
      count: 'SELECT count(*)',
      rate: 'SELECT rate(value, 1 minute)',
    };
    return mapping[agg] || 'SELECT average(value)';
  }

  private mapAggregationToKQL(agg: AggregationType): string {
    const mapping: Record<string, string> = {
      avg: 'avg(value)',
      sum: 'sum(value)',
      min: 'min(value)',
      max: 'max(value)',
      count: 'count()',
    };
    return mapping[agg] || 'avg(value)';
  }

  private mapAggregationToLogQL(agg: AggregationType): string {
    return this.mapAggregationToPromQL(agg);
  }

  private mapAggregationToSPL(agg: AggregationType): string {
    const mapping: Record<string, string> = {
      avg: 'avg(value)',
      sum: 'sum(value)',
      min: 'min(value)',
      max: 'max(value)',
      count: 'count',
    };
    return mapping[agg] || 'avg(value)';
  }
}
