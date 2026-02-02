/**
 * Runbook Engine - Execute automated remediation steps
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
    Runbook,
    RunbookExecution,
    RunbookStep,
    RunbookStepResult,
    RunbookAction
} from './types';

const execAsync = promisify(exec);

export class RunbookEngine {
    private runbooks: Map<string, Runbook> = new Map();
    private executions: Map<string, RunbookExecution> = new Map();

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.loadRunbooks();
        this.registerDefaultRunbooks();
    }

    /**
     * Execute a runbook
     */
    public async executeRunbook(
        runbookId: string,
        incidentId?: string,
        variables?: Record<string, string>
    ): Promise<RunbookExecution> {
        const runbook = this.runbooks.get(runbookId);
        if (!runbook) {
            throw new Error(`Runbook ${runbookId} not found`);
        }

        const execution: RunbookExecution = {
            id: this.generateId(),
            runbookId,
            incidentId,
            startedAt: new Date(),
            status: 'running',
            currentStep: 0,
            stepResults: runbook.steps.map(step => ({
                stepId: step.id,
                status: 'pending'
            })),
            executor: await this.getCurrentUser()
        };

        this.executions.set(execution.id, execution);
        this.outputChannel.appendLine(`[Runbook] Starting execution: ${runbook.name}`);

        // Execute in background
        this.executeSteps(execution, runbook, variables || {}).catch(err => {
            this.outputChannel.appendLine(`[Runbook] Execution failed: ${err.message}`);
        });

        return execution;
    }

    /**
     * Execute runbook steps sequentially
     */
    private async executeSteps(
        execution: RunbookExecution,
        runbook: Runbook,
        variables: Record<string, string>
    ): Promise<void> {
        const mergedVars = { ...runbook.variables, ...variables };

        for (let i = 0; i < runbook.steps.length; i++) {
            execution.currentStep = i;
            const step = runbook.steps[i];
            const result = execution.stepResults[i];

            this.outputChannel.appendLine(`[Runbook] Step ${i + 1}: ${step.name}`);

            result.status = 'running';
            result.startedAt = new Date();

            try {
                if (step.type === 'manual') {
                    await this.executeManualStep(step);
                    result.status = 'success';
                } else if (step.type === 'automated' && step.action) {
                    const output = await this.executeAutomatedStep(step.action, mergedVars);
                    result.output = output;
                    result.status = 'success';
                } else if (step.type === 'validation') {
                    const isValid = await this.executeValidationStep(step);
                    result.status = isValid ? 'success' : 'failed';
                }

                result.completedAt = new Date();
            } catch (error: any) {
                result.status = 'failed';
                result.error = error.message;
                result.completedAt = new Date();

                this.outputChannel.appendLine(`[Runbook] Step failed: ${error.message}`);

                // Execute fallback steps if available
                if (step.fallbackSteps && step.fallbackSteps.length > 0) {
                    this.outputChannel.appendLine(`[Runbook] Executing fallback steps`);
                    // Fallback logic here
                } else {
                    execution.status = 'failed';
                    execution.completedAt = new Date();
                    return;
                }
            }
        }

        execution.status = 'completed';
        execution.completedAt = new Date();
        this.outputChannel.appendLine(`[Runbook] Execution completed successfully`);

        await this.saveExecutions();
    }

    /**
     * Execute manual step (requires user input)
     */
    private async executeManualStep(step: RunbookStep): Promise<void> {
        const action = await vscode.window.showInformationMessage(
            `Manual Step: ${step.name}\n\n${step.description}\n\nExpected: ${step.expectedOutcome}`,
            'Completed',
            'Skip',
            'Cancel'
        );

        if (action === 'Cancel') {
            throw new Error('Manual step cancelled by user');
        } else if (action === 'Skip') {
            throw new Error('Manual step skipped');
        }
    }

    /**
     * Execute automated step
     */
    private async executeAutomatedStep(
        action: RunbookAction,
        variables: Record<string, string>
    ): Promise<string> {
        const command = this.interpolateVariables(action.command, variables);

        switch (action.type) {
            case 'kubectl':
                return await this.executeKubectl(command, action.parameters);
            
            case 'aws_cli':
                return await this.executeAwsCli(command, action.parameters);
            
            case 'azure_cli':
                return await this.executeAzureCli(command, action.parameters);
            
            case 'http':
                return await this.executeHttpRequest(command, action.parameters);
            
            case 'script':
                return await this.executeScript(command, action.timeout);
            
            case 'notification':
                await this.sendNotification(command, action.parameters);
                return 'Notification sent';
            
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * Execute validation step
     */
    private async executeValidationStep(step: RunbookStep): Promise<boolean> {
        const response = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: `Validation: ${step.name} - ${step.description}`
        });

        return response === 'Yes';
    }

    /**
     * Execute kubectl command
     */
    private async executeKubectl(command: string, params: Record<string, any>): Promise<string> {
        const kubectlCmd = `kubectl ${command}`;
        
        if (params.namespace) {
            const fullCmd = `${kubectlCmd} -n ${params.namespace}`;
            const { stdout } = await execAsync(fullCmd);
            return stdout;
        }

        const { stdout } = await execAsync(kubectlCmd);
        return stdout;
    }

    /**
     * Execute AWS CLI command
     */
    private async executeAwsCli(command: string, params: Record<string, any>): Promise<string> {
        const awsCmd = `aws ${command}`;
        const { stdout } = await execAsync(awsCmd);
        return stdout;
    }

    /**
     * Execute Azure CLI command
     */
    private async executeAzureCli(command: string, params: Record<string, any>): Promise<string> {
        const azCmd = `az ${command}`;
        const { stdout } = await execAsync(azCmd);
        return stdout;
    }

    /**
     * Execute HTTP request
     */
    private async executeHttpRequest(url: string, params: Record<string, any>): Promise<string> {
        const axios = require('axios');
        const response = await axios({
            method: params.method || 'GET',
            url,
            data: params.body,
            headers: params.headers
        });
        return JSON.stringify(response.data);
    }

    /**
     * Execute script
     */
    private async executeScript(script: string, timeout: number): Promise<string> {
        const { stdout } = await execAsync(script, { timeout: timeout * 1000 });
        return stdout;
    }

    /**
     * Send notification
     */
    private async sendNotification(message: string, params: Record<string, any>): Promise<void> {
        vscode.window.showInformationMessage(message);
    }

    /**
     * Register a new runbook
     */
    public registerRunbook(runbook: Runbook): void {
        this.runbooks.set(runbook.id, runbook);
        this.saveRunbooks();
    }

    /**
     * Get runbook by ID
     */
    public getRunbook(runbookId: string): Runbook | undefined {
        return this.runbooks.get(runbookId);
    }

    /**
     * List all runbooks
     */
    public listRunbooks(tags?: string[]): Runbook[] {
        let runbooks = Array.from(this.runbooks.values());

        if (tags && tags.length > 0) {
            runbooks = runbooks.filter(r =>
                tags.some(tag => r.tags.includes(tag))
            );
        }

        return runbooks;
    }

    /**
     * Get execution status
     */
    public getExecution(executionId: string): RunbookExecution | undefined {
        return this.executions.get(executionId);
    }

    /**
     * Interpolate variables in command
     */
    private interpolateVariables(template: string, variables: Record<string, string>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return variables[key] || match;
        });
    }

    /**
     * Register default runbooks
     */
    private registerDefaultRunbooks(): void {
        // Kubernetes Pod Restart Runbook
        this.registerRunbook({
            id: 'k8s-pod-restart',
            name: 'Restart Kubernetes Pod',
            description: 'Restart a failing Kubernetes pod',
            triggerConditions: [
                { type: 'alert', condition: 'pod_status != "Running"' }
            ],
            steps: [
                {
                    id: 'verify-pod',
                    name: 'Verify Pod Status',
                    description: 'Check current pod status',
                    type: 'automated',
                    action: {
                        type: 'kubectl',
                        command: 'get pod {{pod_name}}',
                        parameters: { namespace: '{{namespace}}' },
                        timeout: 30
                    }
                },
                {
                    id: 'delete-pod',
                    name: 'Delete Pod',
                    description: 'Delete the pod to trigger restart',
                    type: 'automated',
                    action: {
                        type: 'kubectl',
                        command: 'delete pod {{pod_name}}',
                        parameters: { namespace: '{{namespace}}' },
                        timeout: 30
                    }
                },
                {
                    id: 'verify-restart',
                    name: 'Verify Restart',
                    description: 'Confirm pod is running',
                    type: 'validation',
                    expectedOutcome: 'Pod status is Running'
                }
            ],
            variables: {
                namespace: 'default'
            },
            tags: ['kubernetes', 'pod', 'restart'],
            lastUpdated: new Date()
        });

        // High CPU Mitigation Runbook
        this.registerRunbook({
            id: 'high-cpu-mitigation',
            name: 'High CPU Mitigation',
            description: 'Steps to mitigate high CPU usage',
            triggerConditions: [
                { type: 'metric_threshold', condition: 'cpu_usage > 80%' }
            ],
            steps: [
                {
                    id: 'check-processes',
                    name: 'Check Top Processes',
                    description: 'Identify processes consuming CPU',
                    type: 'manual',
                    expectedOutcome: 'List of top CPU consuming processes'
                },
                {
                    id: 'scale-horizontally',
                    name: 'Scale Application',
                    description: 'Increase replica count',
                    type: 'automated',
                    action: {
                        type: 'kubectl',
                        command: 'scale deployment {{deployment}} --replicas={{replicas}}',
                        parameters: {},
                        timeout: 60
                    }
                },
                {
                    id: 'verify-scaling',
                    name: 'Verify Scaling',
                    description: 'Confirm new replicas are running',
                    type: 'validation',
                    expectedOutcome: 'CPU usage decreased'
                }
            ],
            variables: {
                replicas: '3'
            },
            tags: ['cpu', 'performance', 'scaling'],
            lastUpdated: new Date()
        });
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    private async getCurrentUser(): Promise<string> {
        return process.env.USER || process.env.USERNAME || 'unknown';
    }

    private loadRunbooks(): void {
        const stored = this.context.globalState.get<Record<string, Runbook>>('runbooks', {});
        this.runbooks = new Map(Object.entries(stored));
    }

    private async saveRunbooks(): Promise<void> {
        const stored = Object.fromEntries(this.runbooks);
        await this.context.globalState.update('runbooks', stored);
    }

    private async saveExecutions(): Promise<void> {
        const stored = Object.fromEntries(this.executions);
        await this.context.globalState.update('runbook_executions', stored);
    }
}
