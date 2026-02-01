import * as vscode from 'vscode';
import { CloudCredentials } from './ICloudProvider';

/**
 * Secure credential storage for cloud providers using VS Code secrets API
 */
export class CloudCredentialManager {
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Store credentials for a provider
   */
  public async storeCredentials(providerId: string, credentials: CloudCredentials): Promise<void> {
    try {
      const key = this.getStorageKey(providerId);
      const serialized = JSON.stringify(credentials);
      
      await this.context.secrets.store(key, serialized);
      
      vscode.window.showInformationMessage(`Credentials saved for ${providerId} ✅`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to store credentials: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve credentials for a provider
   */
  public async getCredentials(providerId: string): Promise<CloudCredentials | undefined> {
    try {
      const key = this.getStorageKey(providerId);
      const serialized = await this.context.secrets.get(key);
      
      if (!serialized) {
        return undefined;
      }
      
      return JSON.parse(serialized) as CloudCredentials;
    } catch (error: any) {
      console.error(`Failed to retrieve credentials for ${providerId}:`, error);
      return undefined;
    }
  }

  /**
   * Check if credentials exist for a provider
   */
  public async hasCredentials(providerId: string): Promise<boolean> {
    const credentials = await this.getCredentials(providerId);
    return !!credentials;
  }

  /**
   * Delete credentials for a provider
   */
  public async deleteCredentials(providerId: string): Promise<void> {
    try {
      const key = this.getStorageKey(providerId);
      await this.context.secrets.delete(key);
      
      vscode.window.showInformationMessage(`Credentials deleted for ${providerId}`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to delete credentials: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all provider IDs with stored credentials
   */
  public async getAllConfiguredProviders(): Promise<string[]> {
    // VS Code secrets API doesn't provide a list method
    // We'll maintain a list in global state
    return this.context.globalState.get<string[]>('vitals.configuredProviders', []);
  }

  /**
   * Add provider to configured list
   */
  private async addToConfiguredList(providerId: string): Promise<void> {
    const configured = await this.getAllConfiguredProviders();
    
    if (!configured.includes(providerId)) {
      configured.push(providerId);
      await this.context.globalState.update('vitals.configuredProviders', configured);
    }
  }

  /**
   * Remove provider from configured list
   */
  private async removeFromConfiguredList(providerId: string): Promise<void> {
    const configured = await this.getAllConfiguredProviders();
    const filtered = configured.filter(id => id !== providerId);
    await this.context.globalState.update('vitals.configuredProviders', filtered);
  }

  /**
   * Interactive credential configuration wizard
   */
  public async configureProviderInteractive(providerId: string): Promise<CloudCredentials | undefined> {
    try {
      const providerConfigs: Record<string, ProviderConfig> = {
        datadog: {
          name: 'Datadog',
          fields: [
            { key: 'apiKey', label: 'API Key', password: true },
            { key: 'appKey', label: 'Application Key', password: true },
            { key: 'site', label: 'Site (e.g., datadoghq.com)', password: false, optional: true },
          ],
        },
        newrelic: {
          name: 'New Relic',
          fields: [
            { key: 'apiKey', label: 'API Key', password: true },
            { key: 'accountId', label: 'Account ID', password: false },
            { key: 'region', label: 'Region (US or EU)', password: false, optional: true },
          ],
        },
        aws: {
          name: 'AWS CloudWatch',
          fields: [
            { key: 'accessKeyId', label: 'Access Key ID', password: true },
            { key: 'secretAccessKey', label: 'Secret Access Key', password: true },
            { key: 'region', label: 'Region (e.g., us-east-1)', password: false },
          ],
        },
        azure: {
          name: 'Azure Monitor',
          fields: [
            { key: 'tenantId', label: 'Tenant ID', password: false },
            { key: 'clientId', label: 'Client ID', password: false },
            { key: 'clientSecret', label: 'Client Secret', password: true },
            { key: 'subscriptionId', label: 'Subscription ID', password: false },
          ],
        },
        gcp: {
          name: 'Google Cloud Operations',
          fields: [
            { key: 'projectId', label: 'Project ID', password: false },
            { key: 'serviceAccountKey', label: 'Service Account Key (JSON)', password: true },
          ],
        },
      };

      const config = providerConfigs[providerId];
      if (!config) {
        vscode.window.showErrorMessage(`Unknown provider: ${providerId}`);
        return undefined;
      }

      vscode.window.showInformationMessage(`Configuring ${config.name}...`);

      const credentials: any = {
        type: 'apiKey',
        additionalConfig: {},
      };

      for (const field of config.fields) {
        const value = await vscode.window.showInputBox({
          prompt: field.label,
          password: field.password,
          ignoreFocusOut: true,
          validateInput: (value) => {
            if (!field.optional && !value) {
              return `${field.label} is required`;
            }
            return null;
          },
        });

        if (value === undefined) {
          // User cancelled
          return undefined;
        }

        // Map to CloudCredentials structure
        switch (field.key) {
          case 'apiKey':
          case 'accessKeyId':
            credentials.apiKey = value;
            break;
          case 'appKey':
          case 'secretAccessKey':
          case 'clientSecret':
          case 'serviceAccountKey':
            credentials.apiSecret = value;
            break;
          case 'region':
            credentials.region = value;
            break;
          case 'accountId':
          case 'projectId':
          case 'subscriptionId':
          case 'tenantId':
          case 'clientId':
            credentials.additionalConfig![field.key] = value;
            break;
          case 'site':
            credentials.additionalConfig!.site = value;
            break;
        }
      }

      await this.storeCredentials(providerId, credentials);
      await this.addToConfiguredList(providerId);

      return credentials;
    } catch (error: any) {
      vscode.window.showErrorMessage(`Configuration failed: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Get storage key for a provider
   */
  private getStorageKey(providerId: string): string {
    return `vitals.cloud.${providerId}.credentials`;
  }
}

interface ProviderConfig {
  name: string;
  fields: CredentialField[];
}

interface CredentialField {
  key: string;
  label: string;
  password: boolean;
  optional?: boolean;
}
