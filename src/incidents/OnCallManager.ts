/**
 * On-Call Schedule Manager
 */

import * as vscode from 'vscode';
import {
    OnCallSchedule,
    OnCallRotation,
    OnCallShift,
    EscalationPolicy
} from './types';

export class OnCallManager {
    private schedules: Map<string, OnCallSchedule> = new Map();
    private statusBarItem: vscode.StatusBarItem;

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'vitals.showOnCallSchedule';
        this.loadSchedules();
        this.updateStatusBar();
    }

    /**
     * Get current on-call person
     */
    public getCurrentOnCall(): string | null {
        const now = new Date();
        const currentUser = this.getCurrentUser();

        for (const schedule of this.schedules.values()) {
            for (const rotation of schedule.rotations) {
                for (const shift of rotation.schedule) {
                    if (shift.startTime <= now && shift.endTime >= now) {
                        if (shift.user === currentUser) {
                            return currentUser;
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Check if current user is on-call
     */
    public isOnCall(): boolean {
        return this.getCurrentOnCall() !== null;
    }

    /**
     * Get next on-call person
     */
    public getNextOnCall(scheduleId: string): { user: string; startTime: Date } | null {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            return null;
        }

        const now = new Date();
        let nextShift: OnCallShift | null = null;

        for (const rotation of schedule.rotations) {
            for (const shift of rotation.schedule) {
                if (shift.startTime > now) {
                    if (!nextShift || shift.startTime < nextShift.startTime) {
                        nextShift = shift;
                    }
                }
            }
        }

        return nextShift ? { user: nextShift.user, startTime: nextShift.startTime } : null;
    }

    /**
     * Create on-call schedule
     */
    public async createSchedule(schedule: OnCallSchedule): Promise<void> {
        this.schedules.set(schedule.id, schedule);
        await this.saveSchedules();
        this.updateStatusBar();
        this.outputChannel.appendLine(`[OnCall] Created schedule: ${schedule.name}`);
    }

    /**
     * Get escalation policy
     */
    public getEscalationPolicy(scheduleId: string): EscalationPolicy | undefined {
        const schedule = this.schedules.get(scheduleId);
        return schedule?.escalationPolicy;
    }

    /**
     * Escalate incident based on policy
     */
    public async escalateIncident(
        scheduleId: string,
        incidentId: string,
        currentLevel: number
    ): Promise<string[]> {
        const policy = this.getEscalationPolicy(scheduleId);
        if (!policy) {
            return [];
        }

        const nextLevel = policy.levels.find(l => l.level > currentLevel);
        if (!nextLevel) {
            // No more escalation levels
            return [];
        }

        this.outputChannel.appendLine(
            `[OnCall] Escalating incident ${incidentId} to level ${nextLevel.level}`
        );

        // Wait for delay
        await this.delay(nextLevel.delay * 60 * 1000);

        // Notify users
        for (const user of nextLevel.notifyUsers) {
            vscode.window.showWarningMessage(
                `🚨 ESCALATED: Incident ${incidentId} requires attention`,
                'View Incident'
            ).then(action => {
                if (action === 'View Incident') {
                    vscode.commands.executeCommand('vitals.showIncident', incidentId);
                }
            });
        }

        return nextLevel.notifyUsers;
    }

    /**
     * Update VS Code status bar
     */
    private updateStatusBar(): void {
        if (this.isOnCall()) {
            this.statusBarItem.text = '$(broadcast) On-Call';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.tooltip = 'You are currently on-call. Click to view schedule.';
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    /**
     * Show on-call schedule in webview
     */
    public async showSchedule(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'onCallSchedule',
            'On-Call Schedule',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.getScheduleHtml();
    }

    /**
     * Generate HTML for schedule webview
     */
    private getScheduleHtml(): string {
        const schedules = Array.from(this.schedules.values());
        const currentUser = this.getCurrentUser();
        const onCall = this.isOnCall();

        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
        }
        .status {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
            font-weight: bold;
        }
        .on-call {
            background: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
        }
        .off-call {
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
        }
        .schedule {
            margin-bottom: 30px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
        }
        .schedule h3 {
            margin-top: 0;
        }
        .shift {
            padding: 10px;
            margin: 5px 0;
            background: var(--vscode-editor-background);
            border-radius: 3px;
        }
        .shift.current {
            border-left: 3px solid var(--vscode-charts-orange);
        }
    </style>
</head>
<body>
    <h1>On-Call Schedule</h1>
    
    <div class="status ${onCall ? 'on-call' : 'off-call'}">
        ${onCall ? '🚨 You are currently ON-CALL' : '✅ You are NOT on-call'}
    </div>

    ${schedules.map(schedule => `
        <div class="schedule">
            <h3>${schedule.name}</h3>
            <p><strong>Team:</strong> ${schedule.team}</p>
            <p><strong>Timezone:</strong> ${schedule.timezone}</p>
            
            <h4>Current Rotation:</h4>
            ${schedule.rotations.map(rotation => `
                ${rotation.schedule.map(shift => `
                    <div class="shift ${shift.user === currentUser ? 'current' : ''}">
                        <strong>${shift.user}</strong> 
                        ${shift.isBackup ? '(Backup)' : ''}
                        <br>
                        ${shift.startTime.toLocaleString()} - ${shift.endTime.toLocaleString()}
                    </div>
                `).join('')}
            `).join('')}
        </div>
    `).join('')}
</body>
</html>
        `;
    }

    private getCurrentUser(): string {
        return process.env.USER || process.env.USERNAME || 'unknown';
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private loadSchedules(): void {
        const stored = this.context.globalState.get<Record<string, OnCallSchedule>>('oncall_schedules', {});
        this.schedules = new Map(Object.entries(stored));
    }

    private async saveSchedules(): Promise<void> {
        const stored = Object.fromEntries(this.schedules);
        await this.context.globalState.update('oncall_schedules', stored);
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
