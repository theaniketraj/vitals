/**
 * Integration with PagerDuty, Slack, Teams, Opsgenie
 */

import * as vscode from 'vscode';
import axios from 'axios';
import { Incident, IntegrationConfig } from './types';

export class IntegrationManager {
    private config: IntegrationConfig = {};

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.loadConfig();
    }

    /**
     * Send incident notification to all enabled integrations
     */
    public async notifyIncident(incident: Incident): Promise<void> {
        const promises: Promise<void>[] = [];

        if (this.config.pagerduty?.enabled) {
            promises.push(this.notifyPagerDuty(incident));
        }

        if (this.config.opsgenie?.enabled) {
            promises.push(this.notifyOpsgenie(incident));
        }

        if (this.config.slack?.enabled) {
            promises.push(this.notifySlack(incident));
        }

        if (this.config.teams?.enabled) {
            promises.push(this.notifyTeams(incident));
        }

        await Promise.allSettled(promises);
    }

    /**
     * Send to PagerDuty
     */
    private async notifyPagerDuty(incident: Incident): Promise<void> {
        if (!this.config.pagerduty) return;

        try {
            await axios.post('https://api.pagerduty.com/incidents', {
                incident: {
                    type: 'incident',
                    title: incident.title,
                    service: {
                        id: this.config.pagerduty.serviceId,
                        type: 'service_reference'
                    },
                    urgency: incident.severity === 'critical' ? 'high' : 'low',
                    body: {
                        type: 'incident_body',
                        details: incident.description
                    }
                }
            }, {
                headers: {
                    'Authorization': `Token token=${this.config.pagerduty.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.pagerduty+json;version=2'
                }
            });

            this.outputChannel.appendLine(`[Integration] Sent to PagerDuty: ${incident.id}`);
        } catch (error: any) {
            this.outputChannel.appendLine(`[Integration] PagerDuty error: ${error.message}`);
        }
    }

    /**
     * Send to Opsgenie
     */
    private async notifyOpsgenie(incident: Incident): Promise<void> {
        if (!this.config.opsgenie) return;

        try {
            await axios.post('https://api.opsgenie.com/v2/alerts', {
                message: incident.title,
                description: incident.description,
                priority: this.mapSeverityToPriority(incident.severity),
                tags: incident.tags
            }, {
                headers: {
                    'Authorization': `GenieKey ${this.config.opsgenie.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            this.outputChannel.appendLine(`[Integration] Sent to Opsgenie: ${incident.id}`);
        } catch (error: any) {
            this.outputChannel.appendLine(`[Integration] Opsgenie error: ${error.message}`);
        }
    }

    /**
     * Send to Slack
     */
    private async notifySlack(incident: Incident): Promise<void> {
        if (!this.config.slack) return;

        try {
            const color = this.getSeverityColor(incident.severity);
            
            await axios.post(this.config.slack.webhookUrl, {
                channel: this.config.slack.channel,
                attachments: [
                    {
                        color,
                        title: `🚨 ${incident.severity.toUpperCase()}: ${incident.title}`,
                        text: incident.description,
                        fields: [
                            {
                                title: 'Incident ID',
                                value: incident.id,
                                short: true
                            },
                            {
                                title: 'Status',
                                value: incident.status,
                                short: true
                            },
                            {
                                title: 'Affected Services',
                                value: incident.affectedServices.join(', '),
                                short: false
                            }
                        ],
                        footer: 'Vitals Incident Management',
                        ts: Math.floor(incident.detectedAt.getTime() / 1000)
                    }
                ]
            });

            this.outputChannel.appendLine(`[Integration] Sent to Slack: ${incident.id}`);
        } catch (error: any) {
            this.outputChannel.appendLine(`[Integration] Slack error: ${error.message}`);
        }
    }

    /**
     * Send to Microsoft Teams
     */
    private async notifyTeams(incident: Incident): Promise<void> {
        if (!this.config.teams) return;

        try {
            const color = this.getSeverityColor(incident.severity);
            
            await axios.post(this.config.teams.webhookUrl, {
                '@type': 'MessageCard',
                '@context': 'https://schema.org/extensions',
                summary: incident.title,
                themeColor: color.replace('#', ''),
                sections: [
                    {
                        activityTitle: `🚨 ${incident.severity.toUpperCase()}: ${incident.title}`,
                        activitySubtitle: `Incident ID: ${incident.id}`,
                        facts: [
                            {
                                name: 'Status',
                                value: incident.status
                            },
                            {
                                name: 'Detected At',
                                value: incident.detectedAt.toLocaleString()
                            },
                            {
                                name: 'Affected Services',
                                value: incident.affectedServices.join(', ')
                            }
                        ],
                        text: incident.description
                    }
                ]
            });

            this.outputChannel.appendLine(`[Integration] Sent to Teams: ${incident.id}`);
        } catch (error: any) {
            this.outputChannel.appendLine(`[Integration] Teams error: ${error.message}`);
        }
    }

    /**
     * Configure integration
     */
    public async configureIntegration(service: 'pagerduty' | 'opsgenie' | 'slack' | 'teams'): Promise<void> {
        switch (service) {
            case 'pagerduty':
                await this.configurePagerDuty();
                break;
            case 'opsgenie':
                await this.configureOpsgenie();
                break;
            case 'slack':
                await this.configureSlack();
                break;
            case 'teams':
                await this.configureTeams();
                break;
        }

        await this.saveConfig();
    }

    private async configurePagerDuty(): Promise<void> {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter PagerDuty API Key',
            password: true
        });

        const serviceId = await vscode.window.showInputBox({
            prompt: 'Enter PagerDuty Service ID'
        });

        if (apiKey && serviceId) {
            this.config.pagerduty = { apiKey, serviceId, enabled: true };
        }
    }

    private async configureOpsgenie(): Promise<void> {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter Opsgenie API Key',
            password: true
        });

        const team = await vscode.window.showInputBox({
            prompt: 'Enter Opsgenie Team Name'
        });

        if (apiKey && team) {
            this.config.opsgenie = { apiKey, team, enabled: true };
        }
    }

    private async configureSlack(): Promise<void> {
        const webhookUrl = await vscode.window.showInputBox({
            prompt: 'Enter Slack Webhook URL',
            placeHolder: 'https://hooks.slack.com/services/...'
        });

        const channel = await vscode.window.showInputBox({
            prompt: 'Enter Slack Channel',
            placeHolder: '#incidents'
        });

        if (webhookUrl && channel) {
            this.config.slack = { webhookUrl, channel, enabled: true };
        }
    }

    private async configureTeams(): Promise<void> {
        const webhookUrl = await vscode.window.showInputBox({
            prompt: 'Enter Microsoft Teams Webhook URL',
            placeHolder: 'https://outlook.office.com/webhook/...'
        });

        if (webhookUrl) {
            this.config.teams = { webhookUrl, enabled: true };
        }
    }

    private mapSeverityToPriority(severity: string): string {
        switch (severity) {
            case 'critical': return 'P1';
            case 'high': return 'P2';
            case 'medium': return 'P3';
            case 'low': return 'P4';
            default: return 'P3';
        }
    }

    private getSeverityColor(severity: string): string {
        switch (severity) {
            case 'critical': return '#FF0000';
            case 'high': return '#FF6600';
            case 'medium': return '#FFCC00';
            case 'low': return '#00CC00';
            default: return '#CCCCCC';
        }
    }

    private loadConfig(): void {
        this.config = this.context.globalState.get<IntegrationConfig>('integration_config', {});
    }

    private async saveConfig(): Promise<void> {
        await this.context.globalState.update('integration_config', this.config);
    }
}
