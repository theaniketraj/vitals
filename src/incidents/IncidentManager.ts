/**
 * Incident Manager - Core incident lifecycle management
 */

import * as vscode from 'vscode';
import {
    Incident,
    IncidentSeverity,
    IncidentStatus,
    IncidentTimelineEntry,
    IncidentAnnotation,
    IncidentHypothesis,
    MetricSnapshot,
    LogSnapshot
} from './types';

export class IncidentManager {
    private incidents: Map<string, Incident> = new Map();
    private activeIncidentId: string | null | undefined = null;

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.loadIncidents();
    }

    /**
     * Create new incident from alert or manual trigger
     */
    public async createIncident(params: {
        title: string;
        description: string;
        severity?: IncidentSeverity;
        affectedServices?: string[];
        source?: 'alert' | 'manual' | 'anomaly';
    }): Promise<Incident> {
        const incident: Incident = {
            id: this.generateIncidentId(),
            title: params.title,
            description: params.description,
            severity: params.severity || this.classifySeverity(params.description),
            status: IncidentStatus.Detected,
            detectedAt: new Date(),
            affectedServices: params.affectedServices || [],
            assignedTo: [await this.getCurrentUser()],
            timeline: [
                {
                    timestamp: new Date(),
                    type: 'detection',
                    actor: 'system',
                    description: `Incident detected from ${params.source || 'manual'}`
                }
            ],
            annotations: [],
            hypothesis: [],
            relatedMetrics: [],
            relatedLogs: [],
            relatedTraces: [],
            runbooksExecuted: [],
            tags: this.extractTags(params.description)
        };

        this.incidents.set(incident.id, incident);
        this.activeIncidentId = incident.id;
        await this.saveIncidents();

        this.outputChannel.appendLine(`[Incident] Created: ${incident.id} - ${incident.title}`);

        // Send notifications
        await this.notifyIncidentCreation(incident);

        // Auto-suggest runbooks
        await this.suggestRunbooks(incident);

        return incident;
    }

    /**
     * Update incident status
     */
    public async updateStatus(incidentId: string, status: IncidentStatus): Promise<void> {
        const incident = this.incidents.get(incidentId);
        if (!incident) {
            throw new Error(`Incident ${incidentId} not found`);
        }

        const oldStatus = incident.status;
        incident.status = status;

        incident.timeline.push({
            timestamp: new Date(),
            type: 'status_change',
            actor: await this.getCurrentUser(),
            description: `Status changed from ${oldStatus} to ${status}`
        });

        if (status === IncidentStatus.Resolved) {
            incident.resolvedAt = new Date();
            await this.triggerPostMortemGeneration(incident);
        }

        await this.saveIncidents();
        this.outputChannel.appendLine(`[Incident] ${incidentId} status: ${status}`);
    }

    /**
     * Add annotation to incident
     */
    public async addAnnotation(
        incidentId: string,
        content: string,
        metricReference?: { metric: string; timestamp: Date; value: number }
    ): Promise<void> {
        const incident = this.incidents.get(incidentId);
        if (!incident) {
            throw new Error(`Incident ${incidentId} not found`);
        }

        const annotation: IncidentAnnotation = {
            id: this.generateId(),
            timestamp: new Date(),
            author: await this.getCurrentUser(),
            content,
            metricReference
        };

        incident.annotations.push(annotation);
        await this.saveIncidents();
    }

    /**
     * Track hypothesis during debugging
     */
    public async addHypothesis(
        incidentId: string,
        hypothesis: string
    ): Promise<void> {
        const incident = this.incidents.get(incidentId);
        if (!incident) {
            throw new Error(`Incident ${incidentId} not found`);
        }

        incident.hypothesis.push({
            id: this.generateId(),
            timestamp: new Date(),
            author: await this.getCurrentUser(),
            hypothesis,
            result: 'pending'
        });

        await this.saveIncidents();
    }

    /**
     * Update hypothesis result
     */
    public async updateHypothesis(
        incidentId: string,
        hypothesisId: string,
        result: 'confirmed' | 'rejected',
        evidence?: string
    ): Promise<void> {
        const incident = this.incidents.get(incidentId);
        if (!incident) {
            throw new Error(`Incident ${incidentId} not found`);
        }

        const hypothesis = incident.hypothesis.find(h => h.id === hypothesisId);
        if (hypothesis) {
            hypothesis.result = result;
            hypothesis.evidence = evidence;
            await this.saveIncidents();
        }
    }

    /**
     * Capture metric snapshot during incident
     */
    public async captureMetricSnapshot(
        incidentId: string,
        metric: string,
        value: number,
        query: string,
        datasource: string
    ): Promise<void> {
        const incident = this.incidents.get(incidentId);
        if (!incident) {
            throw new Error(`Incident ${incidentId} not found`);
        }

        incident.relatedMetrics.push({
            metric,
            timestamp: new Date(),
            value,
            query,
            datasource
        });

        await this.saveIncidents();
    }

    /**
     * Capture log snapshot during incident
     */
    public async captureLogSnapshot(
        incidentId: string,
        logs: LogSnapshot[]
    ): Promise<void> {
        const incident = this.incidents.get(incidentId);
        if (!incident) {
            throw new Error(`Incident ${incidentId} not found`);
        }

        incident.relatedLogs.push(...logs);
        await this.saveIncidents();
    }

    /**
     * Get incident by ID
     */
    public getIncident(incidentId: string): Incident | undefined {
        return this.incidents.get(incidentId);
    }

    /**
     * Get active incident
     */
    public getActiveIncident(): Incident | null {
        return this.activeIncidentId ? this.incidents.get(this.activeIncidentId) || null : null;
    }

    /**
     * List all incidents
     */
    public listIncidents(filter?: {
        status?: IncidentStatus;
        severity?: IncidentSeverity;
        since?: Date;
    }): Incident[] {
        let incidents = Array.from(this.incidents.values());

        if (filter?.status) {
            incidents = incidents.filter(i => i.status === filter.status);
        }

        if (filter?.severity) {
            incidents = incidents.filter(i => i.severity === filter.severity);
        }

        if (filter?.since) {
            incidents = incidents.filter(i => i.detectedAt >= filter.since!);
        }

        return incidents.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
    }

    /**
     * Auto-classify incident severity based on content
     */
    private classifySeverity(description: string): IncidentSeverity {
        const lower = description.toLowerCase();

        if (lower.includes('down') || lower.includes('outage') || lower.includes('critical')) {
            return IncidentSeverity.Critical;
        }

        if (lower.includes('high') || lower.includes('degraded') || lower.includes('timeout')) {
            return IncidentSeverity.High;
        }

        if (lower.includes('warning') || lower.includes('slow')) {
            return IncidentSeverity.Medium;
        }

        return IncidentSeverity.Low;
    }

    /**
     * Extract tags from description
     */
    private extractTags(description: string): string[] {
        const tags: string[] = [];
        const tagPatterns = [
            /database|db/i,
            /api|service/i,
            /memory|cpu|disk/i,
            /network|timeout/i,
            /auth|authentication/i
        ];

        tagPatterns.forEach(pattern => {
            if (pattern.test(description)) {
                const match = description.match(pattern);
                if (match) {
                    tags.push(match[0].toLowerCase());
                }
            }
        });

        return tags;
    }

    /**
     * Notify incident creation
     */
    private async notifyIncidentCreation(incident: Incident): Promise<void> {
        // Show VS Code notification
        const action = await vscode.window.showWarningMessage(
            `🚨 ${incident.severity.toUpperCase()}: ${incident.title}`,
            'View Incident',
            'Dismiss'
        );

        if (action === 'View Incident') {
            vscode.commands.executeCommand('vitals.showIncident', incident.id);
        }
    }

    /**
     * Suggest relevant runbooks
     */
    private async suggestRunbooks(incident: Incident): Promise<void> {
        // This will be implemented by RunbookEngine
        this.outputChannel.appendLine(`[Incident] Checking runbooks for: ${incident.id}`);
    }

    /**
     * Trigger post-mortem generation
     */
    private async triggerPostMortemGeneration(incident: Incident): Promise<void> {
        const action = await vscode.window.showInformationMessage(
            `Incident ${incident.id} resolved. Generate post-mortem?`,
            'Generate',
            'Later'
        );

        if (action === 'Generate') {
            vscode.commands.executeCommand('vitals.generatePostMortem', incident.id);
        }
    }

    /**
     * Generate unique incident ID
     */
    private generateIncidentId(): string {
        const prefix = 'INC';
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get current user
     */
    private async getCurrentUser(): Promise<string> {
        return process.env.USER || process.env.USERNAME || 'unknown';
    }

    /**
     * Load incidents from storage
     */
    private loadIncidents(): void {
        const stored = this.context.globalState.get<Record<string, Incident>>('incidents', {});
        this.incidents = new Map(Object.entries(stored));
        this.activeIncidentId = this.context.globalState.get<string | undefined>('activeIncidentId', undefined);
    }

    /**
     * Save incidents to storage
     */
    private async saveIncidents(): Promise<void> {
        const stored = Object.fromEntries(this.incidents);
        await this.context.globalState.update('incidents', stored);
        await this.context.globalState.update('activeIncidentId', this.activeIncidentId);
    }
}
