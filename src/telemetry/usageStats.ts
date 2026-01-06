import * as vscode from 'vscode';
import * as os from 'os';
import { vitalsApi } from '../api/vitalsApi';
import { CustomGitHubAuth } from '../auth/customGitHubAuth';

export interface UsageStatistics {
  // Session info
  sessionId: string;
  sessionStartTime: string;
  sessionDuration?: number;

  // Extension usage
  commandsExecuted: string[];
  dashboardOpens: number;
  dashboardViewDuration: number;

  // Feature usage
  metricsViewed: number;
  logsViewed: number;
  alertsViewed: number;

  // System info (anonymous)
  platform: string;
  vscodeVersion: string;
  extensionVersion: string;

  // Errors encountered
  errors: {
    type: string;
    count: number;
  }[];
}

export class UsageStatsCollector {
  private static instance: UsageStatsCollector;
  private context: vscode.ExtensionContext;
  private sessionId: string;
  private sessionStartTime: Date;
  private stats: UsageStatistics;
  private dashboardOpenTime?: Date;
  private saveInterval?: NodeJS.Timeout;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date();

    this.stats = {
      sessionId: this.sessionId,
      sessionStartTime: this.sessionStartTime.toISOString(),
      commandsExecuted: [],
      dashboardOpens: 0,
      dashboardViewDuration: 0,
      metricsViewed: 0,
      logsViewed: 0,
      alertsViewed: 0,
      platform: `${os.platform()}-${os.arch()}`,
      vscodeVersion: vscode.version,
      extensionVersion: context.extension?.packageJSON?.version || '0.3.0',
      errors: []
    };

    // Auto-save stats every 5 minutes
    this.startAutoSave();

    // Save on extension deactivation
    context.subscriptions.push({
      dispose: () => this.dispose()
    });
  }

  static getInstance(context: vscode.ExtensionContext): UsageStatsCollector {
    if (!UsageStatsCollector.instance) {
      UsageStatsCollector.instance = new UsageStatsCollector(context);
    }
    return UsageStatsCollector.instance;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startAutoSave() {
    // Get save interval from config
    const config = vscode.workspace.getConfiguration('vitals');
    const intervalMinutes = config.get<number>('telemetrySaveInterval') || 5;

    // Save stats periodically
    this.saveInterval = setInterval(() => {
      this.saveStats();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Check if telemetry is enabled
   */
  private isTelemetryEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('vitals');
    return config.get<boolean>('enableTelemetry', true);
  }

  /**
   * Track command execution
   */
  trackCommand(commandName: string) {
    this.stats.commandsExecuted.push(commandName);

    // Track specific command types
    if (commandName === 'vitals.openDashboard') {
      this.stats.dashboardOpens++;
      this.dashboardOpenTime = new Date();
    }
  }

  /**
   * Track dashboard close
   */
  trackDashboardClose() {
    if (this.dashboardOpenTime) {
      const duration = Date.now() - this.dashboardOpenTime.getTime();
      this.stats.dashboardViewDuration += duration;
      this.dashboardOpenTime = undefined;
    }
  }

  /**
   * Track feature usage
   */
  trackFeature(feature: 'metrics' | 'logs' | 'alerts' | 'custom_metrics') {
    switch (feature) {
      case 'metrics':
        this.stats.metricsViewed++;
        break;
      case 'logs':
        this.stats.logsViewed++;
        break;
      case 'alerts':
        this.stats.alertsViewed++;
        break;
      case 'custom_metrics':
        // We might want to track this specifically in the future
        break;
    }
  }

  /**
   * Track error occurrence
   */
  trackError(errorType: string) {
    const existing = this.stats.errors.find(e => e.type === errorType);
    if (existing) {
      existing.count++;
    } else {
      this.stats.errors.push({ type: errorType, count: 1 });
    }
  }

  /**
   * Get current statistics
   */
  getStats(): UsageStatistics {
    return {
      ...this.stats,
      sessionDuration: Date.now() - this.sessionStartTime.getTime()
    };
  }

  /**
   * Save statistics to backend
   */
  async saveStats(): Promise<void> {
    // Check if telemetry is enabled
    if (!this.isTelemetryEnabled()) {
      console.log('Telemetry disabled, skipping stats save');
      return;
    }

    try {
      const user = await CustomGitHubAuth.getCurrentUser(this.context);
      if (!user) {
        console.log('No user logged in, skipping stats save');
        return;
      }

      const currentStats = this.getStats();

      // Send usage statistics as telemetry event
      await vitalsApi.logEvent(
        String(user.id),
        'usage_statistics',
        {
          ...currentStats,
          // Anonymize sensitive data
          commandsExecuted: this.anonymizeCommands(currentStats.commandsExecuted),
        }
      );

      console.log('✅ Usage statistics saved');
    } catch (error) {
      console.error('Failed to save usage statistics:', error);
    }
  }

  /**
   * Anonymize command data - only keep counts per command type
   */
  private anonymizeCommands(commands: string[]): Record<string, number> {
    const commandCounts: Record<string, number> = {};

    for (const cmd of commands) {
      commandCounts[cmd] = (commandCounts[cmd] || 0) + 1;
    }

    return commandCounts;
  }

  /**
   * Generate daily summary
   */
  async generateDailySummary(): Promise<void> {
    // Check if telemetry is enabled
    if (!this.isTelemetryEnabled()) {
      return;
    }

    try {
      const user = await CustomGitHubAuth.getCurrentUser(this.context);
      if (!user) {
        return;
      }

      const summary = {
        date: new Date().toISOString().split('T')[0],
        totalSessions: 1,
        totalCommands: this.stats.commandsExecuted.length,
        totalDashboardOpens: this.stats.dashboardOpens,
        avgSessionDuration: this.getStats().sessionDuration,
        platformDistribution: {
          [this.stats.platform]: 1
        },
        topCommands: this.anonymizeCommands(this.stats.commandsExecuted),
        featureUsage: {
          metrics: this.stats.metricsViewed,
          logs: this.stats.logsViewed,
          alerts: this.stats.alertsViewed
        },
        errorStats: this.stats.errors
      };

      await vitalsApi.logEvent(
        String(user.id),
        'daily_summary',
        summary
      );

      console.log('✅ Daily summary generated');
    } catch (error) {
      console.error('Failed to generate daily summary:', error);
    }
  }

  /**
   * Reset statistics (for new session)
   */
  reset() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date();
    this.stats = {
      sessionId: this.sessionId,
      sessionStartTime: this.sessionStartTime.toISOString(),
      commandsExecuted: [],
      dashboardOpens: 0,
      dashboardViewDuration: 0,
      metricsViewed: 0,
      logsViewed: 0,
      alertsViewed: 0,
      platform: this.stats.platform,
      vscodeVersion: this.stats.vscodeVersion,
      extensionVersion: this.stats.extensionVersion,
      errors: []
    };
  }

  /**
   * Cleanup on extension deactivation
   */
  async dispose() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    // Save final stats
    await this.saveStats();

    // Generate daily summary
    await this.generateDailySummary();
  }
}

/**
 * Singleton instance getter
 */
export function getUsageStats(context: vscode.ExtensionContext): UsageStatsCollector {
  return UsageStatsCollector.getInstance(context);
}
