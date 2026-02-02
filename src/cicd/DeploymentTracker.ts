/**
 * Deployment Tracker - Automatic deployment detection and tracking
 */

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { promisify } from 'util';
import {
    Deployment,
    DeploymentStatus,
    DeploymentStrategy,
    DeploymentAnnotation,
    CICDConfig,
    CIPlatform
} from './types';

const execAsync = promisify(child_process.exec);

export class DeploymentTracker {
    private deployments: Map<string, Deployment> = new Map();
    private annotations: DeploymentAnnotation[] = [];
    private webhookServer?: any;

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.loadDeployments();
        this.startGitTagWatcher();
    }

    /**
     * Detect deployments from Git tags
     */
    async detectDeploymentsFromGitTags(tagPattern: string = '^v\\d+\\.\\d+\\.\\d+$'): Promise<Deployment[]> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                this.outputChannel.appendLine('No workspace folder found');
                return [];
            }

            const repoPath = workspaceFolders[0].uri.fsPath;
            
            // Get recent tags with commit info
            const { stdout } = await execAsync(
                `git -C "${repoPath}" tag -l --sort=-creatordate --format="%(refname:short)|%(objectname:short)|%(creatordate:iso8601)|%(taggername)" | head -20`
            );

            const newDeployments: Deployment[] = [];
            const lines = stdout.trim().split('\n').filter(line => line);

            for (const line of lines) {
                const [tag, commitSha, date, author] = line.split('|');
                
                // Check if tag matches pattern
                const regex = new RegExp(tagPattern);
                if (!regex.test(tag)) continue;

                // Check if we already tracked this deployment
                const deploymentId = `git-tag-${commitSha}`;
                if (this.deployments.has(deploymentId)) continue;

                // Get commit message
                const { stdout: commitMsg } = await execAsync(
                    `git -C "${repoPath}" log -1 --pretty=%B ${commitSha}`
                );

                // Get affected services (files changed in this commit)
                const { stdout: filesChanged } = await execAsync(
                    `git -C "${repoPath}" diff-tree --no-commit-id --name-only -r ${commitSha}`
                );
                const services = this.extractServicesFromFiles(filesChanged.split('\n'));

                const deployment: Deployment = {
                    id: deploymentId,
                    timestamp: new Date(date),
                    environment: this.inferEnvironmentFromTag(tag),
                    version: tag,
                    commitSha,
                    commitMessage: commitMsg.trim(),
                    author: author || 'unknown',
                    status: DeploymentStatus.Success,
                    strategy: DeploymentStrategy.Standard,
                    services
                };

                this.deployments.set(deploymentId, deployment);
                newDeployments.push(deployment);
                
                this.outputChannel.appendLine(`Detected deployment: ${tag} (${commitSha})`);
            }

            await this.saveDeployments();
            return newDeployments;

        } catch (error) {
            this.outputChannel.appendLine(`Error detecting deployments: ${error}`);
            return [];
        }
    }

    /**
     * Register deployment from CI/CD webhook
     */
    async registerDeployment(deployment: Partial<Deployment>): Promise<Deployment> {
        const id = deployment.id || `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const fullDeployment: Deployment = {
            id,
            timestamp: deployment.timestamp || new Date(),
            environment: deployment.environment || 'production',
            version: deployment.version || 'unknown',
            commitSha: deployment.commitSha || '',
            commitMessage: deployment.commitMessage || '',
            author: deployment.author || 'unknown',
            status: deployment.status || DeploymentStatus.InProgress,
            strategy: deployment.strategy || DeploymentStrategy.Standard,
            services: deployment.services || [],
            metadata: deployment.metadata
        };

        this.deployments.set(id, fullDeployment);
        await this.saveDeployments();

        this.outputChannel.appendLine(
            `📦 Registered deployment: ${fullDeployment.version} to ${fullDeployment.environment}`
        );

        // Show notification
        vscode.window.showInformationMessage(
            `Deployment ${fullDeployment.version} started in ${fullDeployment.environment}`
        );

        return fullDeployment;
    }

    /**
     * Update deployment status
     */
    async updateDeploymentStatus(
        deploymentId: string, 
        status: DeploymentStatus, 
        duration?: number
    ): Promise<void> {
        const deployment = this.deployments.get(deploymentId);
        if (!deployment) {
            throw new Error(`Deployment ${deploymentId} not found`);
        }

        deployment.status = status;
        deployment.duration = duration;

        await this.saveDeployments();

        const icon = status === DeploymentStatus.Success ? '✅' : 
                     status === DeploymentStatus.Failed ? '❌' : '🔄';
        
        this.outputChannel.appendLine(
            `${icon} Deployment ${deployment.version}: ${status}`
        );

        if (status === DeploymentStatus.Failed) {
            vscode.window.showErrorMessage(
                `Deployment ${deployment.version} failed in ${deployment.environment}`
            );
        }
    }

    /**
     * Get deployment by ID
     */
    getDeployment(deploymentId: string): Deployment | undefined {
        return this.deployments.get(deploymentId);
    }

    /**
     * List deployments with optional filters
     */
    listDeployments(filters?: {
        environment?: string;
        status?: DeploymentStatus;
        since?: Date;
        limit?: number;
    }): Deployment[] {
        let deployments = Array.from(this.deployments.values());

        if (filters?.environment) {
            deployments = deployments.filter(d => d.environment === filters.environment);
        }

        if (filters?.status) {
            deployments = deployments.filter(d => d.status === filters.status);
        }

        if (filters?.since) {
            deployments = deployments.filter(d => d.timestamp >= filters.since!);
        }

        // Sort by timestamp descending
        deployments.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (filters?.limit) {
            deployments = deployments.slice(0, filters.limit);
        }

        return deployments;
    }

    /**
     * Get deployments within time range (for chart annotations)
     */
    getDeploymentsInRange(startTime: Date, endTime: Date, environment?: string): Deployment[] {
        let deployments = Array.from(this.deployments.values())
            .filter(d => d.timestamp >= startTime && d.timestamp <= endTime);

        if (environment) {
            deployments = deployments.filter(d => d.environment === environment);
        }

        return deployments.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    /**
     * Add annotation to deployment (for charts)
     */
    async addAnnotation(annotation: DeploymentAnnotation): Promise<void> {
        this.annotations.push(annotation);
        await this.context.globalState.update('cicd.annotations', this.annotations);
    }

    /**
     * Get annotations for time range
     */
    getAnnotations(startTime: Date, endTime: Date): DeploymentAnnotation[] {
        return this.annotations.filter(
            a => a.timestamp >= startTime && a.timestamp <= endTime
        );
    }

    /**
     * Compare two deployments
     */
    compareDeployments(deploymentId1: string, deploymentId2: string): {
        older: Deployment;
        newer: Deployment;
        timeDelta: number;
        versionDelta: string;
    } | null {
        const d1 = this.deployments.get(deploymentId1);
        const d2 = this.deployments.get(deploymentId2);

        if (!d1 || !d2) return null;

        const [older, newer] = d1.timestamp < d2.timestamp ? [d1, d2] : [d2, d1];

        return {
            older,
            newer,
            timeDelta: newer.timestamp.getTime() - older.timestamp.getTime(),
            versionDelta: `${older.version} → ${newer.version}`
        };
    }

    /**
     * Start watching for new Git tags
     */
    private startGitTagWatcher(): void {
        // Watch every 5 minutes for new tags
        const interval = setInterval(async () => {
            const config = this.context.globalState.get<CICDConfig>('cicd.config');
            if (config?.deploymentDetection.useGitTags) {
                await this.detectDeploymentsFromGitTags(config.deploymentDetection.tagPattern);
            }
        }, 5 * 60 * 1000);

        this.context.subscriptions.push({
            dispose: () => clearInterval(interval)
        });
    }

    /**
     * Extract service names from changed files
     */
    private extractServicesFromFiles(files: string[]): string[] {
        const services = new Set<string>();
        
        for (const file of files) {
            if (!file) continue;
            
            // Extract service name from path patterns
            // e.g., services/api-gateway/... → api-gateway
            const serviceMatch = file.match(/^services\/([^\/]+)/);
            if (serviceMatch) {
                services.add(serviceMatch[1]);
            }
            
            // e.g., backend/payment-service/... → payment-service
            const backendMatch = file.match(/^backend\/([^\/]+)/);
            if (backendMatch) {
                services.add(backendMatch[1]);
            }
        }

        return Array.from(services);
    }

    /**
     * Infer environment from tag name
     */
    private inferEnvironmentFromTag(tag: string): string {
        if (tag.includes('prod') || tag.includes('release')) return 'production';
        if (tag.includes('staging') || tag.includes('stg')) return 'staging';
        if (tag.includes('dev')) return 'development';
        return 'production'; // default
    }

    /**
     * Load deployments from storage
     */
    private loadDeployments(): void {
        const stored = this.context.globalState.get<Record<string, Deployment>>('cicd.deployments', {});
        this.deployments = new Map(
            Object.entries(stored).map(([id, d]) => [
                id,
                { ...d, timestamp: new Date(d.timestamp) }
            ])
        );

        const storedAnnotations = this.context.globalState.get<DeploymentAnnotation[]>('cicd.annotations', []);
        this.annotations = storedAnnotations.map(a => ({
            ...a,
            timestamp: new Date(a.timestamp)
        }));
    }

    /**
     * Save deployments to storage
     */
    private async saveDeployments(): Promise<void> {
        const stored = Object.fromEntries(this.deployments);
        await this.context.globalState.update('cicd.deployments', stored);
    }
}
