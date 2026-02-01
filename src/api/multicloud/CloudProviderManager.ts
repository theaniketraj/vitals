import { ICloudProvider, QueryResult, UnifiedQuery, QueryOptions, CostMetrics } from './ICloudProvider';
import * as vscode from 'vscode';

/**
 * Manages multiple cloud provider integrations
 */
export class CloudProviderManager {
  private readonly providers: Map<string, ICloudProvider> = new Map();
  private activeProviders: Set<string> = new Set();
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadActiveProviders();
  }

  /**
   * Register a cloud provider
   */
  public registerProvider(provider: ICloudProvider): void {
    this.providers.set(provider.providerId, provider);
    console.log(`Registered cloud provider: ${provider.providerName}`);
  }

  /**
   * Get a specific provider
   */
  public getProvider(providerId: string): ICloudProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all registered providers
   */
  public getAllProviders(): ICloudProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all active providers
   */
  public getActiveProviders(): ICloudProvider[] {
    return Array.from(this.activeProviders)
      .map(id => this.providers.get(id))
      .filter((p): p is ICloudProvider => p !== undefined);
  }

  /**
   * Enable a provider
   */
  public async enableProvider(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    // Test connection before enabling
    const status = await provider.testConnection();
    if (!status.connected) {
      throw new Error(`Cannot enable ${providerId}: ${status.error}`);
    }

    this.activeProviders.add(providerId);
    await this.saveActiveProviders();
    console.log(`Enabled provider: ${provider.providerName}`);
  }

  /**
   * Disable a provider
   */
  public async disableProvider(providerId: string): Promise<void> {
    this.activeProviders.delete(providerId);
    await this.saveActiveProviders();
    console.log(`Disabled provider: ${providerId}`);
  }

  /**
   * Query all active providers with unified query
   */
  public async queryAll(unifiedQuery: UnifiedQuery, options?: QueryOptions): Promise<Map<string, QueryResult>> {
    const results = new Map<string, QueryResult>();
    const activeProviders = this.getActiveProviders();

    await Promise.allSettled(
      activeProviders.map(async (provider) => {
        try {
          const result = await provider.executeUnifiedQuery(unifiedQuery, options);
          results.set(provider.providerId, result);
        } catch (error) {
          console.error(`Failed to query ${provider.providerName}:`, error);
        }
      })
    );

    return results;
  }

  /**
   * Query specific providers
   */
  public async queryProviders(
    providerIds: string[],
    unifiedQuery: UnifiedQuery,
    options?: QueryOptions
  ): Promise<Map<string, QueryResult>> {
    const results = new Map<string, QueryResult>();

    await Promise.allSettled(
      providerIds.map(async (providerId) => {
        const provider = this.providers.get(providerId);
        if (!provider) {
          console.error(`Provider ${providerId} not found`);
          return;
        }

        try {
          const result = await provider.executeUnifiedQuery(unifiedQuery, options);
          results.set(providerId, result);
        } catch (error) {
          console.error(`Failed to query ${provider.providerName}:`, error);
        }
      })
    );

    return results;
  }

  /**
   * Get aggregated cost metrics from all active providers
   */
  public async getAggregatedCosts(): Promise<CostMetrics[]> {
    const activeProviders = this.getActiveProviders();
    const costs: CostMetrics[] = [];

    await Promise.allSettled(
      activeProviders.map(async (provider) => {
        try {
          const cost = await provider.getCostMetrics();
          costs.push(cost);
        } catch (error) {
          console.error(`Failed to get cost metrics from ${provider.providerName}:`, error);
        }
      })
    );

    return costs;
  }

  /**
   * Test connections for all active providers
   */
  public async testAllConnections(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const activeProviders = this.getActiveProviders();

    await Promise.allSettled(
      activeProviders.map(async (provider) => {
        try {
          const status = await provider.testConnection();
          results.set(provider.providerId, status.connected);
        } catch (error) {
          results.set(provider.providerId, false);
        }
      })
    );

    return results;
  }

  /**
   * Load active providers from storage
   */
  private loadActiveProviders(): void {
    const saved = this.context.globalState.get<string[]>('vitals.activeProviders', []);
    this.activeProviders = new Set(saved);
  }

  /**
   * Save active providers to storage
   */
  private async saveActiveProviders(): Promise<void> {
    await this.context.globalState.update(
      'vitals.activeProviders',
      Array.from(this.activeProviders)
    );
  }
}
