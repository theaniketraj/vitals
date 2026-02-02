/**
 * Release Notes Generator - Auto-generate release notes with performance data
 */

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { promisify } from 'util';
import {
    ReleaseNotes,
    Deployment,
    CommitInfo,
    PerformanceChange,
    FeatureFlagChange,
    SLOCompliance
} from './types';

const execAsync = promisify(child_process.exec);

export class ReleaseNotesGenerator {
    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Generate release notes for deployment
     */
    async generateReleaseNotes(
        deployment: Deployment,
        previousDeployment?: Deployment,
        options?: {
            includePerformance?: boolean;
            includeSLO?: boolean;
            includeFeatureFlags?: boolean;
        }
    ): Promise<ReleaseNotes> {
        this.outputChannel.appendLine(
            `📝 Generating release notes for ${deployment.version}...`
        );

        const opts = {
            includePerformance: true,
            includeSLO: true,
            includeFeatureFlags: true,
            ...options
        };

        // Fetch commits between deployments
        const commits = await this.fetchCommits(deployment, previousDeployment);

        // Categorize commits
        const { newFeatures, bugFixes, breakingChanges } = this.categorizeCommits(commits);

        // Fetch performance data
        const performanceImprovements: PerformanceChange[] = opts.includePerformance
            ? await this.fetchPerformanceChanges(deployment, previousDeployment, true)
            : [];

        const performanceRegressions: PerformanceChange[] = opts.includePerformance
            ? await this.fetchPerformanceChanges(deployment, previousDeployment, false)
            : [];

        // Fetch SLO compliance
        const sloCompliance: SLOCompliance[] = opts.includeSLO
            ? await this.fetchSLOCompliance(deployment)
            : [];

        // Fetch feature flag changes
        const featureFlags: FeatureFlagChange[] = opts.includeFeatureFlags
            ? await this.fetchFeatureFlagChanges(deployment, previousDeployment)
            : [];

        // Generate markdown
        const markdown = this.generateMarkdown({
            version: deployment.version,
            deploymentId: deployment.id,
            timestamp: deployment.timestamp,
            environment: deployment.environment,
            commits,
            performanceImprovements,
            performanceRegressions,
            sloCompliance,
            featureFlags,
            breakingChanges,
            bugFixes,
            newFeatures
        });

        const releaseNotes: ReleaseNotes = {
            version: deployment.version,
            deploymentId: deployment.id,
            timestamp: deployment.timestamp,
            environment: deployment.environment,
            commits,
            performanceImprovements,
            performanceRegressions,
            sloCompliance,
            featureFlags,
            breakingChanges,
            bugFixes,
            newFeatures,
            markdown
        };

        // Save to file
        await this.saveReleaseNotes(releaseNotes);

        this.outputChannel.appendLine(
            `✅ Release notes generated: ${newFeatures.length} features, ${bugFixes.length} fixes, ${performanceImprovements.length} improvements`
        );

        return releaseNotes;
    }

    /**
     * Fetch commits between deployments
     */
    private async fetchCommits(
        deployment: Deployment,
        previousDeployment?: Deployment
    ): Promise<CommitInfo[]> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return [];

            const repoPath = workspaceFolders[0].uri.fsPath;
            
            // Get commit range
            const range = previousDeployment
                ? `${previousDeployment.commitSha}..${deployment.commitSha}`
                : deployment.commitSha;

            // Fetch commit log
            const { stdout } = await execAsync(
                `git -C "${repoPath}" log ${range} --pretty=format:"%H|%s|%an|%aI" --no-merges`
            );

            const commits: CommitInfo[] = [];
            const lines = stdout.trim().split('\n').filter(line => line);

            for (const line of lines) {
                const [sha, message, author, timestamp] = line.split('|');
                
                // Extract PR number if present
                const prMatch = message.match(/#(\d+)/);
                const prNumber = prMatch ? parseInt(prMatch[1]) : undefined;

                commits.push({
                    sha: sha.substring(0, 7),
                    message: message.trim(),
                    author,
                    timestamp: new Date(timestamp),
                    prNumber,
                    prTitle: prNumber ? message.split('#')[0].trim() : undefined
                });
            }

            return commits;

        } catch (error) {
            this.outputChannel.appendLine(`Warning: Could not fetch commits: ${error}`);
            return [];
        }
    }

    /**
     * Categorize commits by type
     */
    private categorizeCommits(commits: CommitInfo[]): {
        newFeatures: string[];
        bugFixes: string[];
        breakingChanges: string[];
    } {
        const newFeatures: string[] = [];
        const bugFixes: string[] = [];
        const breakingChanges: string[] = [];

        for (const commit of commits) {
            const msg = commit.message.toLowerCase();
            
            if (msg.includes('breaking') || msg.includes('breaking change')) {
                breakingChanges.push(commit.message);
            } else if (msg.startsWith('feat') || msg.includes('feature') || msg.includes('add')) {
                newFeatures.push(commit.message);
            } else if (msg.startsWith('fix') || msg.includes('bug') || msg.includes('fixed')) {
                bugFixes.push(commit.message);
            }
        }

        return { newFeatures, bugFixes, breakingChanges };
    }

    /**
     * Fetch performance changes
     */
    private async fetchPerformanceChanges(
        deployment: Deployment,
        previousDeployment: Deployment | undefined,
        improvements: boolean
    ): Promise<PerformanceChange[]> {
        // In real implementation, fetch actual metrics
        // For now, generate mock data

        const mockChanges: PerformanceChange[] = [
            {
                metric: 'Response Time (p95)',
                before: 180,
                after: 165,
                percentChange: -8.3,
                improvement: true
            },
            {
                metric: 'Error Rate',
                before: 0.025,
                after: 0.018,
                percentChange: -28.0,
                improvement: true
            },
            {
                metric: 'Throughput (req/s)',
                before: 1200,
                after: 1350,
                percentChange: 12.5,
                improvement: true
            }
        ];

        return improvements
            ? mockChanges.filter(c => c.improvement)
            : mockChanges.filter(c => !c.improvement);
    }

    /**
     * Fetch SLO compliance data
     */
    private async fetchSLOCompliance(deployment: Deployment): Promise<SLOCompliance[]> {
        // Mock SLO compliance data
        return [
            {
                deploymentId: deployment.id,
                sloName: 'API Availability',
                target: 99.9,
                actual: 99.95,
                compliant: true,
                budget: 0.05,
                timeWindow: '30d'
            },
            {
                deploymentId: deployment.id,
                sloName: 'Request Latency',
                target: 99.5,
                actual: 99.7,
                compliant: true,
                budget: 0.2,
                timeWindow: '30d'
            }
        ];
    }

    /**
     * Fetch feature flag changes
     */
    private async fetchFeatureFlagChanges(
        deployment: Deployment,
        previousDeployment?: Deployment
    ): Promise<FeatureFlagChange[]> {
        // Mock feature flag changes
        return [
            {
                flagKey: 'new-checkout-flow',
                action: 'rollout_increased',
                previousValue: 25,
                newValue: 50
            }
        ];
    }

    /**
     * Generate markdown content
     */
    private generateMarkdown(releaseNotes: Omit<ReleaseNotes, 'markdown'>): string {
        const { version, timestamp, environment, commits, performanceImprovements, 
                performanceRegressions, sloCompliance, featureFlags, breakingChanges, 
                bugFixes, newFeatures } = releaseNotes;

        let markdown = `# Release Notes: ${version}\n\n`;
        markdown += `**Environment:** ${environment}  \n`;
        markdown += `**Deployed:** ${timestamp.toLocaleString()}  \n`;
        markdown += `**Commits:** ${commits.length}  \n\n`;

        markdown += `---\n\n`;

        // Executive Summary
        markdown += `## 📊 Executive Summary\n\n`;
        markdown += `This release includes ${newFeatures.length} new features, ${bugFixes.length} bug fixes`;
        if (breakingChanges.length > 0) {
            markdown += `, and ${breakingChanges.length} breaking changes`;
        }
        markdown += `.  \n\n`;

        if (performanceImprovements.length > 0) {
            markdown += `Performance improvements include:\n`;
            performanceImprovements.slice(0, 3).forEach(improvement => {
                markdown += `- **${improvement.metric}**: ${improvement.percentChange > 0 ? '+' : ''}${improvement.percentChange.toFixed(1)}% improvement\n`;
            });
            markdown += `\n`;
        }

        // Breaking Changes
        if (breakingChanges.length > 0) {
            markdown += `## ⚠️ Breaking Changes\n\n`;
            breakingChanges.forEach(change => {
                markdown += `- ${change}\n`;
            });
            markdown += `\n`;
        }

        // New Features
        if (newFeatures.length > 0) {
            markdown += `## ✨ New Features\n\n`;
            newFeatures.forEach(feature => {
                markdown += `- ${feature}\n`;
            });
            markdown += `\n`;
        }

        // Bug Fixes
        if (bugFixes.length > 0) {
            markdown += `## 🐛 Bug Fixes\n\n`;
            bugFixes.forEach(fix => {
                markdown += `- ${fix}\n`;
            });
            markdown += `\n`;
        }

        // Performance Changes
        if (performanceImprovements.length > 0 || performanceRegressions.length > 0) {
            markdown += `## 📈 Performance Impact\n\n`;
            
            if (performanceImprovements.length > 0) {
                markdown += `### Improvements ✅\n\n`;
                markdown += `| Metric | Before | After | Change |\n`;
                markdown += `|--------|--------|-------|--------|\n`;
                performanceImprovements.forEach(improvement => {
                    markdown += `| ${improvement.metric} | ${improvement.before.toFixed(2)} | ${improvement.after.toFixed(2)} | ${improvement.percentChange > 0 ? '+' : ''}${improvement.percentChange.toFixed(1)}% |\n`;
                });
                markdown += `\n`;
            }

            if (performanceRegressions.length > 0) {
                markdown += `### Regressions ⚠️\n\n`;
                markdown += `| Metric | Before | After | Change |\n`;
                markdown += `|--------|--------|-------|--------|\n`;
                performanceRegressions.forEach(regression => {
                    markdown += `| ${regression.metric} | ${regression.before.toFixed(2)} | ${regression.after.toFixed(2)} | ${regression.percentChange > 0 ? '+' : ''}${regression.percentChange.toFixed(1)}% |\n`;
                });
                markdown += `\n`;
            }
        }

        // SLO Compliance
        if (sloCompliance.length > 0) {
            markdown += `## 🎯 SLO Compliance\n\n`;
            markdown += `| SLO | Target | Actual | Status | Budget |\n`;
            markdown += `|-----|--------|--------|--------|--------|\n`;
            sloCompliance.forEach(slo => {
                const status = slo.compliant ? '✅' : '❌';
                markdown += `| ${slo.sloName} | ${slo.target}% | ${slo.actual.toFixed(3)}% | ${status} | ${slo.budget.toFixed(3)}% |\n`;
            });
            markdown += `\n`;
        }

        // Feature Flags
        if (featureFlags.length > 0) {
            markdown += `## 🚩 Feature Flag Changes\n\n`;
            featureFlags.forEach(flag => {
                const actionText = flag.action.replace(/_/g, ' ');
                markdown += `- **${flag.flagKey}**: ${actionText}`;
                if (flag.previousValue !== undefined && flag.newValue !== undefined) {
                    markdown += ` (${flag.previousValue}% → ${flag.newValue}%)`;
                }
                markdown += `\n`;
            });
            markdown += `\n`;
        }

        // All Commits
        markdown += `## 📝 All Changes\n\n`;
        commits.forEach(commit => {
            markdown += `- ${commit.message} ([${commit.sha}](https://github.com/yourrepo/commit/${commit.sha}))`;
            if (commit.prNumber) {
                markdown += ` (#${commit.prNumber})`;
            }
            markdown += `\n`;
        });

        return markdown;
    }

    /**
     * Save release notes to file
     */
    private async saveReleaseNotes(releaseNotes: ReleaseNotes): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const releasesDir = vscode.Uri.joinPath(workspaceFolders[0].uri, 'release-notes');
        
        // Create directory if it doesn't exist
        try {
            await vscode.workspace.fs.createDirectory(releasesDir);
        } catch (error) {
            // Directory might already exist
        }

        // Save as markdown file
        const filename = `${releaseNotes.version.replace(/[^a-zA-Z0-9.-]/g, '_')}_${releaseNotes.environment}.md`;
        const filepath = vscode.Uri.joinPath(releasesDir, filename);

        await vscode.workspace.fs.writeFile(
            filepath,
            Buffer.from(releaseNotes.markdown, 'utf-8')
        );

        this.outputChannel.appendLine(`💾 Release notes saved: ${filepath.fsPath}`);

        // Open the file
        const doc = await vscode.workspace.openTextDocument(filepath);
        await vscode.window.showTextDocument(doc, { preview: false });
    }
}
