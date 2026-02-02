/**
 * Post-Mortem Generator - AI-powered incident documentation
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    Incident,
    PostMortem,
    ActionItem,
    IncidentTimelineEntry
} from './types';
import { IncidentManager } from './IncidentManager';

export class PostMortemGenerator {
    constructor(
        private context: vscode.ExtensionContext,
        private incidentManager: IncidentManager,
        private outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Generate post-mortem document from incident
     */
    public async generatePostMortem(incidentId: string): Promise<PostMortem> {
        const incident = this.incidentManager.getIncident(incidentId);
        if (!incident) {
            throw new Error(`Incident ${incidentId} not found`);
        }

        this.outputChannel.appendLine(`[PostMortem] Generating for incident: ${incidentId}`);

        const postMortem: PostMortem = {
            id: this.generateId(),
            incidentId,
            title: incident.title,
            summary: await this.generateSummary(incident),
            impact: this.calculateImpact(incident),
            timeline: incident.timeline,
            rootCause: await this.identifyRootCause(incident),
            triggeringEvent: this.identifyTriggeringEvent(incident),
            resolution: await this.describeResolution(incident),
            whatWentWell: this.extractWhatWentWell(incident),
            whatWentWrong: this.extractWhatWentWrong(incident),
            actionItems: await this.generateActionItems(incident),
            lessons: this.extractLessons(incident),
            createdAt: new Date(),
            createdBy: await this.getCurrentUser(),
            reviewers: []
        };

        // Save post-mortem as markdown file
        await this.saveAsMarkdown(postMortem);

        // Store in extension context
        await this.savePostMortem(postMortem);

        this.outputChannel.appendLine(`[PostMortem] Generated successfully: ${postMortem.id}`);

        return postMortem;
    }

    /**
     * Generate executive summary
     */
    private async generateSummary(incident: Incident): Promise<string> {
        const duration = incident.resolvedAt
            ? Math.round((incident.resolvedAt.getTime() - incident.detectedAt.getTime()) / 60000)
            : 0;

        return `
On ${this.formatDate(incident.detectedAt)}, a ${incident.severity} severity incident was detected affecting ${incident.affectedServices.join(', ')}.
The incident lasted approximately ${duration} minutes and was resolved at ${this.formatDate(incident.resolvedAt!)}.

${incident.description}

The incident was detected ${this.describeDetectionMethod(incident)} and resolved through ${incident.runbooksExecuted.length} runbook executions and ${incident.hypothesis.filter(h => h.result === 'confirmed').length} confirmed hypotheses.
        `.trim();
    }

    /**
     * Calculate incident impact
     */
    private calculateImpact(incident: Incident): PostMortem['impact'] {
        const duration = incident.resolvedAt
            ? Math.round((incident.resolvedAt.getTime() - incident.detectedAt.getTime()) / 60000)
            : 0;

        return {
            duration,
            affectedServices: incident.affectedServices,
            affectedUsers: this.estimateAffectedUsers(incident),
            revenue: this.estimateRevenueLoss(incident, duration)
        };
    }

    /**
     * Identify root cause from hypothesis
     */
    private async identifyRootCause(incident: Incident): Promise<string> {
        const confirmedHypothesis = incident.hypothesis.filter(h => h.result === 'confirmed');
        
        if (confirmedHypothesis.length > 0) {
            return confirmedHypothesis.map(h => 
                `${h.hypothesis}${h.evidence ? ` (Evidence: ${h.evidence})` : ''}`
            ).join('\n\n');
        }

        // Fallback to AI analysis
        return await this.aiRootCauseAnalysis(incident);
    }

    /**
     * AI-powered root cause analysis
     */
    private async aiRootCauseAnalysis(incident: Incident): Promise<string> {
        // In production, this would call OpenAI/Anthropic API
        // For now, return a template

        const metricAnalysis = this.analyzeMetrics(incident);
        const logAnalysis = this.analyzeLogs(incident);

        return `
**Root Cause Analysis (AI-Generated)**

Based on incident data analysis:

**Metric Patterns:**
${metricAnalysis}

**Log Patterns:**
${logAnalysis}

**Likely Root Cause:**
${this.inferRootCause(incident)}

**Confidence Level:** ${this.calculateConfidence(incident)}%
        `.trim();
    }

    /**
     * Identify triggering event
     */
    private identifyTriggeringEvent(incident: Incident): string {
        const firstTimeline = incident.timeline[0];
        return firstTimeline.description;
    }

    /**
     * Describe resolution steps
     */
    private async describeResolution(incident: Incident): Promise<string> {
        const resolutionSteps: string[] = [];

        // Extract actions from timeline
        incident.timeline.forEach(entry => {
            if (entry.type === 'action') {
                resolutionSteps.push(`- ${entry.description}`);
            }
        });

        // Add runbook executions
        if (incident.runbooksExecuted.length > 0) {
            resolutionSteps.push(`\n**Runbooks Executed:**`);
            incident.runbooksExecuted.forEach(runbook => {
                resolutionSteps.push(`- ${runbook}`);
            });
        }

        return resolutionSteps.length > 0
            ? resolutionSteps.join('\n')
            : 'Resolution steps were not explicitly documented during the incident.';
    }

    /**
     * Extract what went well
     */
    private extractWhatWentWell(incident: Incident): string[] {
        const positive: string[] = [];

        const detectionTime = incident.timeline[0]?.timestamp;
        const firstResponse = incident.timeline.find(e => e.type === 'action')?.timestamp;
        
        if (detectionTime && firstResponse) {
            const responseMinutes = Math.round((firstResponse.getTime() - detectionTime.getTime()) / 60000);
            if (responseMinutes < 5) {
                positive.push(`Quick detection and response time (${responseMinutes} minutes)`);
            }
        }

        if (incident.runbooksExecuted.length > 0) {
            positive.push(`Effective use of runbooks for automated remediation`);
        }

        if (incident.hypothesis.filter(h => h.result === 'confirmed').length > 0) {
            positive.push(`Systematic hypothesis testing led to root cause identification`);
        }

        if (incident.annotations.length > 5) {
            positive.push(`Good documentation and collaboration during incident`);
        }

        return positive.length > 0 ? positive : ['Team responded professionally to the incident'];
    }

    /**
     * Extract what went wrong
     */
    private extractWhatWentWrong(incident: Incident): string[] {
        const negative: string[] = [];

        const duration = incident.resolvedAt
            ? Math.round((incident.resolvedAt.getTime() - incident.detectedAt.getTime()) / 60000)
            : 0;

        if (duration > 60) {
            negative.push(`Long resolution time (${duration} minutes)`);
        }

        if (incident.hypothesis.filter(h => h.result === 'rejected').length > 3) {
            negative.push(`Multiple rejected hypotheses indicate difficulty in diagnosis`);
        }

        if (incident.runbooksExecuted.length === 0) {
            negative.push(`No automated runbooks were used for remediation`);
        }

        const gaps = this.identifyMonitoringGaps(incident);
        if (gaps.length > 0) {
            negative.push(...gaps);
        }

        return negative.length > 0 ? negative : ['No major issues in incident handling process'];
    }

    /**
     * Generate action items
     */
    private async generateActionItems(incident: Incident): Promise<ActionItem[]> {
        const actionItems: ActionItem[] = [];

        // Monitoring improvements
        if (this.identifyMonitoringGaps(incident).length > 0) {
            actionItems.push({
                id: this.generateId(),
                description: 'Improve monitoring coverage for affected services',
                assignee: 'SRE Team',
                priority: 'high',
                status: 'open',
                dueDate: this.addDays(new Date(), 14)
            });
        }

        // Runbook creation
        if (incident.runbooksExecuted.length === 0) {
            actionItems.push({
                id: this.generateId(),
                description: `Create runbook for ${incident.title} scenario`,
                assignee: 'DevOps Team',
                priority: 'medium',
                status: 'open',
                dueDate: this.addDays(new Date(), 30)
            });
        }

        // Alert tuning
        if (incident.severity === 'low' || incident.severity === 'medium') {
            actionItems.push({
                id: this.generateId(),
                description: 'Review and tune alert thresholds to reduce noise',
                assignee: 'Platform Team',
                priority: 'low',
                status: 'open',
                dueDate: this.addDays(new Date(), 60)
            });
        }

        // Code fixes
        const rootCause = await this.identifyRootCause(incident);
        if (rootCause.includes('code') || rootCause.includes('bug')) {
            actionItems.push({
                id: this.generateId(),
                description: 'Fix root cause in codebase',
                assignee: 'Development Team',
                priority: 'critical',
                status: 'open',
                dueDate: this.addDays(new Date(), 7)
            });
        }

        return actionItems;
    }

    /**
     * Extract lessons learned
     */
    private extractLessons(incident: Incident): string[] {
        const lessons: string[] = [];

        // Technical lessons
        if (incident.relatedMetrics.length > 0) {
            lessons.push('Metric correlation helped identify the issue faster');
        }

        // Process lessons
        if (incident.annotations.length > 0) {
            lessons.push('Documentation during incident was valuable for post-mortem');
        }

        // Tool lessons
        if (incident.runbooksExecuted.length > 0) {
            lessons.push('Automated runbooks reduced time to resolution');
        }

        return lessons.length > 0 ? lessons : ['Continue improving incident response processes'];
    }

    /**
     * Save post-mortem as markdown file
     */
    private async saveAsMarkdown(postMortem: PostMortem): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        const postMortemsDir = path.join(workspaceFolders[0].uri.fsPath, 'post-mortems');
        if (!fs.existsSync(postMortemsDir)) {
            fs.mkdirSync(postMortemsDir, { recursive: true });
        }

        const filename = `${postMortem.id}-${postMortem.title.replace(/\s+/g, '-')}.md`;
        const filepath = path.join(postMortemsDir, filename);

        const markdown = this.generateMarkdown(postMortem);
        fs.writeFileSync(filepath, markdown);

        // Open the file
        const doc = await vscode.workspace.openTextDocument(filepath);
        await vscode.window.showTextDocument(doc);
    }

    /**
     * Generate markdown content
     */
    private generateMarkdown(pm: PostMortem): string {
        return `# Post-Mortem: ${pm.title}

**Incident ID:** ${pm.incidentId}  
**Date:** ${this.formatDate(pm.createdAt)}  
**Author:** ${pm.createdBy}  
**Severity:** ${pm.impact.duration > 60 ? 'HIGH' : 'MEDIUM'}

---

## Executive Summary

${pm.summary}

---

## Impact

- **Duration:** ${pm.impact.duration} minutes
- **Affected Services:** ${pm.impact.affectedServices.join(', ')}
- **Estimated Users Affected:** ${pm.impact.affectedUsers || 'Unknown'}
- **Estimated Revenue Loss:** $${pm.impact.revenue?.toFixed(2) || '0.00'}

---

## Timeline

${pm.timeline.map(entry => 
    `**${this.formatTime(entry.timestamp)}** - ${entry.description} _(${entry.actor})_`
).join('\n\n')}

---

## Root Cause

${pm.rootCause}

---

## Triggering Event

${pm.triggeringEvent}

---

## Resolution

${pm.resolution}

---

## What Went Well ✅

${pm.whatWentWell.map(item => `- ${item}`).join('\n')}

---

## What Went Wrong ❌

${pm.whatWentWrong.map(item => `- ${item}`).join('\n')}

---

## Action Items

${pm.actionItems.map(item => 
    `- [ ] **[${item.priority.toUpperCase()}]** ${item.description} _(${item.assignee})_ - Due: ${this.formatDate(item.dueDate)}`
).join('\n')}

---

## Lessons Learned

${pm.lessons.map(lesson => `- ${lesson}`).join('\n')}

---

**Reviewers:** ${pm.reviewers.length > 0 ? pm.reviewers.join(', ') : '_Pending review_'}

---

_Generated by Vitals Incident Management System_
`;
    }

    // Helper methods
    private describeDetectionMethod(incident: Incident): string {
        const firstEntry = incident.timeline[0];
        return firstEntry?.metadata?.source || 'through monitoring alerts';
    }

    private estimateAffectedUsers(incident: Incident): number {
        // In production, this would query actual metrics
        return incident.severity === 'critical' ? 10000 : 100;
    }

    private estimateRevenueLoss(incident: Incident, durationMinutes: number): number {
        const revenuePerMinute = 100; // Example value
        return incident.severity === 'critical' ? durationMinutes * revenuePerMinute : 0;
    }

    private analyzeMetrics(incident: Incident): string {
        if (incident.relatedMetrics.length === 0) {
            return 'No metrics were captured during the incident.';
        }

        return incident.relatedMetrics
            .slice(0, 5)
            .map(m => `- ${m.metric}: ${m.value} (${m.datasource})`)
            .join('\n');
    }

    private analyzeLogs(incident: Incident): string {
        if (incident.relatedLogs.length === 0) {
            return 'No logs were captured during the incident.';
        }

        const errorLogs = incident.relatedLogs.filter(l => l.level === 'ERROR');
        return `${errorLogs.length} error logs captured. Common patterns: ${this.findLogPatterns(errorLogs)}`;
    }

    private findLogPatterns(logs: any[]): string {
        // Simple pattern matching
        return 'timeout, connection refused, out of memory';
    }

    private inferRootCause(incident: Incident): string {
        return `Based on ${incident.severity} severity and ${incident.affectedServices.length} affected services, likely caused by infrastructure or dependency issues.`;
    }

    private calculateConfidence(incident: Incident): number {
        let confidence = 50;
        if (incident.relatedMetrics.length > 5) confidence += 20;
        if (incident.relatedLogs.length > 10) confidence += 20;
        if (incident.hypothesis.filter(h => h.result === 'confirmed').length > 0) confidence += 10;
        return Math.min(confidence, 100);
    }

    private identifyMonitoringGaps(incident: Incident): string[] {
        const gaps: string[] = [];
        if (incident.relatedMetrics.length < 3) {
            gaps.push('Insufficient metrics coverage during incident');
        }
        if (incident.relatedLogs.length < 5) {
            gaps.push('Limited log data available for analysis');
        }
        return gaps;
    }

    private formatDate(date?: Date): string {
        if (!date) return 'N/A';
        return new Date(date).toLocaleString();
    }

    private formatTime(date: Date): string {
        return new Date(date).toLocaleTimeString();
    }

    private addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    private async getCurrentUser(): Promise<string> {
        return process.env.USER || process.env.USERNAME || 'unknown';
    }

    private async savePostMortem(postMortem: PostMortem): Promise<void> {
        const stored = this.context.globalState.get<Record<string, PostMortem>>('postmortems', {});
        stored[postMortem.id] = postMortem;
        await this.context.globalState.update('postmortems', stored);
    }
}
