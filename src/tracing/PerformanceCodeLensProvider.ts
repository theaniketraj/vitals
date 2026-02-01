import * as vscode from 'vscode';
import {
  PerformanceAnnotation,
  Trace,
  HotFunction,
  DatabaseQueryAnalysis,
  PerformanceRegression,
} from './ITraceProvider';
import { TraceManager } from './TraceManager';
import { PerformanceProfiler } from './PerformanceProfiler';

/**
 * Provides inline performance annotations in the code editor using CodeLens
 */
export class PerformanceCodeLensProvider implements vscode.CodeLensProvider {
  private annotations = new Map<string, PerformanceAnnotation[]>();
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(
    private traceManager: TraceManager,
    private profiler: PerformanceProfiler
  ) {}

  /**
   * Update annotations for a service
   */
  public async updateAnnotations(serviceName: string, traces: Trace[]): Promise<void> {
    const annotationsByFile = new Map<string, PerformanceAnnotation[]>();

    for (const trace of traces) {
      // Extract hot functions
      const hotFunctions = this.profiler.extractHotFunctions(trace, serviceName);

      for (const func of hotFunctions) {
        if (func.file && func.line) {
          const annotation: PerformanceAnnotation = {
            file: func.file,
            line: func.line,
            type: 'hot-path',
            severity: func.percentage > 20 ? 'error' : func.percentage > 10 ? 'warning' : 'info',
            message: `Hot path: ${func.percentage.toFixed(1)}% of total time`,
            metric: {
              value: func.selfTime / 1000,
              unit: 'ms',
            },
            suggestion: func.percentage > 20
              ? 'Consider optimizing this function - it accounts for a significant portion of execution time'
              : undefined,
            traceIds: [trace.traceId],
          };

          const fileAnnotations = annotationsByFile.get(func.file) || [];
          fileAnnotations.push(annotation);
          annotationsByFile.set(func.file, fileAnnotations);
        }
      }

      // Analyze database queries
      const dbAnalysis = this.profiler.analyzeDatabaseQueries(trace);

      // N+1 detection
      for (const nPlusOne of dbAnalysis.nPlusOneDetections) {
        for (const spanId of nPlusOne.spanIds) {
          const span = trace.spans.find(s => s.spanId === spanId);
          if (span) {
            const file = span.tags['code.filepath'] as string;
            const line = span.tags['code.lineno'] as number;

            if (file && line) {
              const annotation: PerformanceAnnotation = {
                file,
                line,
                type: 'n-plus-one',
                severity: 'warning',
                message: `N+1 query detected (${nPlusOne.occurrences} occurrences)`,
                metric: {
                  value: nPlusOne.totalDuration / 1000,
                  unit: 'ms',
                },
                suggestion: nPlusOne.suggestion,
                traceIds: nPlusOne.spanIds,
              };

              const fileAnnotations = annotationsByFile.get(file) || [];
              fileAnnotations.push(annotation);
              annotationsByFile.set(file, fileAnnotations);
            }
          }
        }
      }

      // Slow queries
      for (const query of dbAnalysis.slowQueries) {
        if (query.spanId) {
          const span = trace.spans.find(s => s.spanId === query.spanId);
          if (span) {
            const file = span.tags['code.filepath'] as string;
            const line = span.tags['code.lineno'] as number;

            if (file && line) {
              const annotation: PerformanceAnnotation = {
                file,
                line,
                type: 'slow-function',
                severity: query.duration > 5000000 ? 'error' : 'warning',
                message: `Slow database query: ${(query.duration / 1000).toFixed(1)}ms`,
                metric: {
                  value: query.duration / 1000,
                  unit: 'ms',
                },
                suggestion: 'Consider adding indexes or optimizing the query',
                traceIds: [trace.traceId],
              };

              const fileAnnotations = annotationsByFile.get(file) || [];
              fileAnnotations.push(annotation);
              annotationsByFile.set(file, fileAnnotations);
            }
          }
        }
      }
    }

    // Merge annotations by file and line
    for (const [file, fileAnnotations] of annotationsByFile) {
      const merged = this.mergeAnnotations(fileAnnotations);
      this.annotations.set(file, merged);
    }

    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Merge multiple annotations for the same location
   */
  private mergeAnnotations(annotations: PerformanceAnnotation[]): PerformanceAnnotation[] {
    const byLocation = new Map<number, PerformanceAnnotation[]>();

    for (const annotation of annotations) {
      const existing = byLocation.get(annotation.line) || [];
      existing.push(annotation);
      byLocation.set(annotation.line, existing);
    }

    const merged: PerformanceAnnotation[] = [];

    for (const [line, lineAnnotations] of byLocation) {
      if (lineAnnotations.length === 1) {
        merged.push(lineAnnotations[0]);
      } else {
        // Merge multiple annotations
        const severityOrder = { error: 3, warning: 2, info: 1 };
        const maxSeverity = lineAnnotations.reduce((max, a) =>
          severityOrder[a.severity] > severityOrder[max.severity] ? a : max
        ).severity;

        const totalValue = lineAnnotations.reduce((sum, a) => sum + a.metric.value, 0);
        const allTraceIds = lineAnnotations.flatMap(a => a.traceIds || []);

        merged.push({
          file: lineAnnotations[0].file,
          line,
          type: 'optimization',
          severity: maxSeverity,
          message: `Multiple performance issues (${lineAnnotations.length})`,
          metric: {
            value: totalValue,
            unit: lineAnnotations[0].metric.unit,
          },
          suggestion: 'Click to see details',
          traceIds: allTraceIds,
        });
      }
    }

    return merged;
  }

  /**
   * Provide CodeLens for a document
   */
  public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const annotations = this.annotations.get(document.uri.fsPath);

    if (!annotations || annotations.length === 0) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];

    for (const annotation of annotations) {
      const line = document.lineAt(Math.max(0, annotation.line - 1)); // Convert to 0-based
      const range = line.range;

      const lens = new vscode.CodeLens(range, {
        title: this.formatAnnotation(annotation),
        command: 'vitals.showPerformanceDetails',
        arguments: [annotation],
      });

      codeLenses.push(lens);
    }

    return codeLenses;
  }

  private formatAnnotation(annotation: PerformanceAnnotation): string {
    const icon = this.getSeverityIcon(annotation.severity);
    return `${icon} ${annotation.message} (${annotation.metric.value.toFixed(1)}${annotation.metric.unit})`;
  }

  private getSeverityIcon(severity: PerformanceAnnotation['severity']): string {
    switch (severity) {
      case 'error':
        return '🔴';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
    }
  }

  /**
   * Clear all annotations
   */
  public clearAnnotations(): void {
    this.annotations.clear();
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Clear annotations for a specific file
   */
  public clearFileAnnotations(filePath: string): void {
    this.annotations.delete(filePath);
    this._onDidChangeCodeLenses.fire();
  }
}
