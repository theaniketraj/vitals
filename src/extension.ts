// Main entry point for the VS Code extension
import * as vscode from "vscode";
import { VitalsViewProvider } from "./vitalsView";
import { CustomGitHubAuth } from "./auth/customGitHubAuth";
import { AuthWall } from "./auth/authWall";
import { vitalsApi } from "./api/vitalsApi";
import { getUsageStats } from "./telemetry/usageStats";
import { checkVersionUpdate } from "./utils/updateNotifier";
import {
  TraceManager,
  PerformanceProfiler,
  PerformanceCodeLensProvider,
  VisualizationGenerator,
  Trace,
} from "./tracing";
import { IncidentManager } from "./incidents/IncidentManager";
import { RunbookEngine } from "./incidents/RunbookEngine";
import { PostMortemGenerator } from "./incidents/PostMortemGenerator";
import { OnCallManager } from "./incidents/OnCallManager";
import { IntegrationManager } from "./incidents/IntegrationManager";
import { IncidentStatus } from "./incidents/types";
import { DeploymentTracker } from "./cicd/DeploymentTracker";
import { PerformanceImpactAnalyzer } from "./cicd/PerformanceImpactAnalyzer";
import { RollbackEngine } from "./cicd/RollbackEngine";
import { CIPipelineMonitor } from "./cicd/CIPipelineMonitor";
import { FeatureFlagManager } from "./cicd/FeatureFlagManager";
import { ReleaseNotesGenerator } from "./cicd/ReleaseNotesGenerator";

// Called when the extension is activated (e.g., when a command is executed)
export async function activate(context: vscode.ExtensionContext) {
  // Log activation for debugging
  console.log("🚀 Vitals extension activated");

  // Check for updates
  checkVersionUpdate(context);

  // Initialize usage statistics collector
  const usageStats = getUsageStats(context);

  // Initialize tracing infrastructure
  const traceManager = new TraceManager(context);
  const profiler = new PerformanceProfiler();
  const codeLensProvider = new PerformanceCodeLensProvider(traceManager, profiler);
  const visualizationGenerator = new VisualizationGenerator();

  // Initialize incident management infrastructure
  const outputChannel = vscode.window.createOutputChannel('Vitals Incidents');
  const incidentManager = new IncidentManager(context, outputChannel);
  const runbookEngine = new RunbookEngine(context, outputChannel);
  const postMortemGenerator = new PostMortemGenerator(context, incidentManager, outputChannel);
  const onCallManager = new OnCallManager(context, outputChannel);
  const integrationManager = new IntegrationManager(context, outputChannel);

  // Initialize CI/CD integration infrastructure
  const cicdOutputChannel = vscode.window.createOutputChannel('Vitals CI/CD');
  const deploymentTracker = new DeploymentTracker(context, cicdOutputChannel);
  const performanceImpactAnalyzer = new PerformanceImpactAnalyzer(context, cicdOutputChannel);
  const rollbackEngine = new RollbackEngine(context, cicdOutputChannel);
  const ciPipelineMonitor = new CIPipelineMonitor(context, cicdOutputChannel);
  const featureFlagManager = new FeatureFlagManager(context, cicdOutputChannel);
  const releaseNotesGenerator = new ReleaseNotesGenerator(context, cicdOutputChannel);

  // Register CodeLens provider for all languages
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: 'file' },
      codeLensProvider
    )
  );

  // Register the WebviewViewProvider
  const provider = new VitalsViewProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VitalsViewProvider.viewType, provider)
  );

  // Check authentication status
  const authStatus = await AuthWall.checkStatus(context);
  
  if (authStatus.isSignedIn && authStatus.authCompleted) {
    // Returning user - show brief confirmation
    console.log(`✅ Signed in as: ${authStatus.user?.login}`);
    
    // Log extension activation for signed-in users
    if (authStatus.user) {
      vitalsApi.logEvent(
        authStatus.user.id.toString(),
        'extension_activated'
      ).catch(err => console.error('Failed to log event:', err));
    }
  } else {
    // New user or not authenticated - show auth wall after a brief delay
    setTimeout(() => {
      AuthWall.showAuthWall(context);
    }, 1000);
  }

  // Register the command to open the Vitals dashboard
  const openDashboard = vscode.commands.registerCommand(
    "vitals.openDashboard",
    async () => {
      console.log("📊 Opening Vitals dashboard...");
      
      // Track command execution
      usageStats.trackCommand('vitals.openDashboard');
      
      // Enforce authentication wall
      console.log("🔐 Checking authentication...");
      const isAuthenticated = await AuthWall.enforce(context);
      console.log(`🔐 Authentication result: ${isAuthenticated}`);
      
      if (!isAuthenticated) {
        console.log("❌ User not authenticated, aborting dashboard open");
        return;
      }
      
      console.log("✅ User authenticated, showing dashboard view...");
      
      // Log dashboard opened event
      const user = await CustomGitHubAuth.getCurrentUser(context);
      if (user) {
        console.log(`👤 Current user: ${user.login}`);
        vitalsApi.logEvent(
          user.id.toString(),
          'dashboard_opened'
        ).catch(err => console.error('Failed to log event:', err));
      }
      
      // Focus the dashboard view
      provider.show();
      console.log("✅ Dashboard view focused");
    }
  );  

  // Register sign-out command
  const signOut = vscode.commands.registerCommand(
    "vitals.signOut",
    async () => {
      usageStats.trackCommand('vitals.signOut');
      
      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to sign out? You will need to authenticate again to use Vitals.',
        { modal: true },
        'Sign Out',
        'Cancel'
      );
      
      if (confirm === 'Sign Out') {
        // Save stats before signing out
        await usageStats.saveStats();
        await AuthWall.reset(context);
        vscode.window.showInformationMessage('Successfully signed out from Vitals');
      }
    }
  );

  // Register status command to show current user
  const showStatus = vscode.commands.registerCommand(
    "vitals.showStatus",
    async () => {
      usageStats.trackCommand('vitals.showStatus');
      
      const status = await AuthWall.checkStatus(context);
      
      if (status.isSignedIn && status.user) {
        vscode.window.showInformationMessage(
          `✅ Signed in as: ${status.user.name || status.user.login} (@${status.user.login})`,
          'Open Dashboard',
          'Sign Out'
        ).then(selection => {
          if (selection === 'Open Dashboard') {
            vscode.commands.executeCommand('vitals.openDashboard');
          } else if (selection === 'Sign Out') {
            vscode.commands.executeCommand('vitals.signOut');
          }
        });
      } else {
        vscode.window.showInformationMessage(
          '❌ Not signed in to Vitals',
          'Sign In'
        ).then(selection => {
          if (selection === 'Sign In') {
            vscode.commands.executeCommand('vitals.openDashboard');
          }
        });
      }
    }
  );



  // Register sign in command (for returning users who signed out)
  const signIn = vscode.commands.registerCommand(
    "vitals.signIn",
    async () => {
      const isAuthenticated = await AuthWall.showAuthWall(context);
      if (isAuthenticated) {
        vscode.window.showInformationMessage(
          'Successfully signed in! What would you like to do?',
          'Open Dashboard',
          'View Status'
        ).then(selection => {
          if (selection === 'Open Dashboard') {
            vscode.commands.executeCommand('vitals.openDashboard');
          } else if (selection === 'View Status') {
            vscode.commands.executeCommand('vitals.showStatus');
          }
        });
      }
    }
  );

  // Register command to configure Prometheus URL
  const configurePrometheus = vscode.commands.registerCommand(
    "vitals.configurePrometheus",
    async () => {
      // Track command execution
      usageStats.trackCommand('vitals.configurePrometheus');
      
      // Get current Prometheus URL
      const config = vscode.workspace.getConfiguration('vitals');
      const currentUrl = config.get<string>('prometheusUrl') || 'http://localhost:9090';
      const defaultUrl = config.inspect('prometheusUrl')?.defaultValue as string;
      
      // Determine if using demo mode
      const isDemoMode = currentUrl === defaultUrl;
      
      // Show input box with guidance
      const newUrl = await vscode.window.showInputBox({
        prompt: 'Enter your Prometheus server URL',
        value: currentUrl,
        placeHolder: 'http://localhost:9090',
        validateInput: (value) => {
          if (!value) {
            return 'URL cannot be empty';
          }
          try {
            new URL(value);
            return null;
          } catch {
            return 'Please enter a valid URL (e.g., http://localhost:9090)';
          }
        },
        ignoreFocusOut: true,
        title: isDemoMode 
          ? '🎯 Currently using Demo Mode - Enter your Prometheus URL to connect to your own instance'
          : '🔗 Configure Prometheus URL'
      });
      
      if (newUrl && newUrl !== currentUrl) {
        await config.update('prometheusUrl', newUrl, vscode.ConfigurationTarget.Global);
        
        const wasDemo = currentUrl === defaultUrl;
        const nowDemo = newUrl === defaultUrl;
        
        if (wasDemo && !nowDemo) {
          vscode.window.showInformationMessage(
            `✅ Switched to custom Prometheus: ${newUrl}`
          );
        } else if (!wasDemo && nowDemo) {
          vscode.window.showInformationMessage(
            '✅ Switched back to demo mode'
          );
        } else {
          vscode.window.showInformationMessage(
            `✅ Prometheus URL updated: ${newUrl}`
          );
        }
        
        // Suggest reopening dashboard if it's open
        vscode.window.showInformationMessage(
          'Reopen the Vitals dashboard to see updated metrics',
          'Reopen Dashboard'
        ).then(selection => {
          if (selection === 'Reopen Dashboard') {
            vscode.commands.executeCommand('vitals.openDashboard');
          }
        });
      }
    }
  );

  // Register command to configure cloud providers
  const configureCloudProvider = vscode.commands.registerCommand(
    "vitals.configureCloudProvider",
    async () => {
      usageStats.trackCommand('vitals.configureCloudProvider');
      
      const providerOptions = [
        { label: '$(cloud) Datadog', description: 'Datadog APM & Metrics', value: 'datadog' },
        { label: '$(cloud) New Relic', description: 'New Relic Insights', value: 'newrelic' },
        { label: '$(cloud) AWS CloudWatch', description: 'AWS CloudWatch & X-Ray', value: 'aws' },
        { label: '$(cloud) Azure Monitor', description: 'Azure Monitor & Application Insights', value: 'azure' },
        { label: '$(cloud) Google Cloud', description: 'Google Cloud Operations', value: 'gcp' },
      ];

      const selected = await vscode.window.showQuickPick(providerOptions, {
        placeHolder: 'Select a cloud provider to configure',
        title: 'Configure Cloud Provider',
      });

      if (selected) {
        const { CloudCredentialManager } = await import('./api/multicloud');
        const credentialManager = new CloudCredentialManager(context);
        await credentialManager.configureProviderInteractive(selected.value);
      }
    }
  );

  // Register command to view cost metrics
  const viewCostMetrics = vscode.commands.registerCommand(
    "vitals.viewCostMetrics",
    async () => {
      usageStats.trackCommand('vitals.viewCostMetrics');
      vscode.window.showInformationMessage('Opening cost metrics dashboard...');
      provider.show();
    }
  );

  // Register command to configure trace provider
  const configureTraceProvider = vscode.commands.registerCommand(
    "vitals.configureTraceProvider",
    async () => {
      usageStats.trackCommand('vitals.configureTraceProvider');

      const providerOptions = [
        { label: '$(symbol-event) Jaeger', description: 'Jaeger distributed tracing', value: 'jaeger' },
        { label: '$(symbol-event) OpenTelemetry', description: 'OpenTelemetry collector', value: 'opentelemetry' },
      ];

      const selected = await vscode.window.showQuickPick(providerOptions, {
        placeHolder: 'Select a trace provider to configure',
        title: 'Configure Trace Provider',
      });

      if (!selected) {
        return;
      }

      const endpoint = await vscode.window.showInputBox({
        prompt: `Enter ${selected.label} endpoint URL`,
        placeHolder: selected.value === 'jaeger' ? 'http://localhost:16686' : 'http://localhost:4318',
        validateInput: (value) => {
          if (!value) return 'Endpoint cannot be empty';
          try {
            new URL(value);
            return null;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      });

      if (!endpoint) {
        return;
      }

      // Get optional API key
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter API key (optional, press Enter to skip)',
        password: true,
      });

      try {
        const provider = traceManager.getProvider(selected.value);
        if (provider) {
          await provider.configureAuth({
            endpoint,
            apiKey: apiKey || undefined,
          });

          const testSuccess = await provider.testConnection();

          if (testSuccess) {
            traceManager.setActiveProvider(selected.value);
            vscode.window.showInformationMessage(`Successfully connected to ${selected.label}`);
          } else {
            vscode.window.showErrorMessage(
              `Failed to connect to ${selected.label}. Please check your endpoint and credentials.`
            );
          }
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error configuring trace provider: ${error.message}`);
      }
    }
  );

  // Register command to search traces
  const searchTraces = vscode.commands.registerCommand(
    "vitals.searchTraces",
    async () => {
      usageStats.trackCommand('vitals.searchTraces');

      if (!traceManager.getActiveProvider()) {
        const configure = await vscode.window.showWarningMessage(
          'No trace provider configured',
          'Configure Now'
        );
        if (configure) {
          vscode.commands.executeCommand('vitals.configureTraceProvider');
        }
        return;
      }

      const serviceName = await vscode.window.showInputBox({
        prompt: 'Enter service name (optional)',
        placeHolder: 'my-service',
      });

      const operation = await vscode.window.showInputBox({
        prompt: 'Enter operation name (optional)',
        placeHolder: '/api/users',
      });

      const durationOption = await vscode.window.showQuickPick(
        [
          { label: 'Any duration', value: undefined },
          { label: 'Slow traces (>1s)', value: 1000 },
          { label: 'Very slow traces (>5s)', value: 5000 },
        ],
        { placeHolder: 'Filter by duration' }
      );

      try {
        const now = Date.now();
        const traces = await traceManager.searchTraces({
          serviceName: serviceName || undefined,
          operationName: operation || undefined,
          minDuration: durationOption?.value,
          timeRange: {
            start: now - 3600000, // Last hour
            end: now,
          },
          limit: 20,
        });

        if (traces.length === 0) {
          vscode.window.showInformationMessage('No traces found');
          return;
        }

        const traceItems = traces.map(t => ({
          label: `$(symbol-event) ${t.services.join(' → ')}`,
          description: `${(t.duration / 1000).toFixed(2)}ms`,
          detail: `Trace ID: ${t.traceId} | ${t.spans.length} spans`,
          trace: t,
        }));

        const selected = await vscode.window.showQuickPick(traceItems, {
          placeHolder: 'Select a trace to view details',
        });

        if (selected) {
          vscode.commands.executeCommand('vitals.showTraceDetails', selected.trace);
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error searching traces: ${error.message}`);
      }
    }
  );

  // Register command to show trace details
  const showTraceDetails = vscode.commands.registerCommand(
    "vitals.showTraceDetails",
    async (trace: Trace) => {
      usageStats.trackCommand('vitals.showTraceDetails');

      const panel = vscode.window.createWebviewPanel(
        'traceDetails',
        `Trace: ${trace.traceId.substring(0, 8)}`,
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      const flameGraph = profiler.generateCPUFlameGraph(trace);
      panel.webview.html = visualizationGenerator.generateFlameGraphHTML(
        flameGraph,
        `Trace Flame Graph - ${trace.traceId}`
      );
    }
  );

  // Register command to view service map
  const viewServiceMap = vscode.commands.registerCommand(
    "vitals.viewServiceMap",
    async () => {
      usageStats.trackCommand('vitals.viewServiceMap');

      if (!traceManager.getActiveProvider()) {
        const configure = await vscode.window.showWarningMessage(
          'No trace provider configured',
          'Configure Now'
        );
        if (configure) {
          vscode.commands.executeCommand('vitals.configureTraceProvider');
        }
        return;
      }

      try {
        const now = Date.now();
        const serviceMap = await traceManager.getServiceMap({
          start: now - 3600000, // Last hour
          end: now,
        });

        const panel = vscode.window.createWebviewPanel(
          'serviceMap',
          'Service Dependency Map',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = visualizationGenerator.generateServiceMapHTML(serviceMap);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error generating service map: ${error.message}`);
      }
    }
  );

  // Register command to analyze performance
  const analyzePerformance = vscode.commands.registerCommand(
    "vitals.analyzePerformance",
    async () => {
      usageStats.trackCommand('vitals.analyzePerformance');

      if (!traceManager.getActiveProvider()) {
        const configure = await vscode.window.showWarningMessage(
          'No trace provider configured',
          'Configure Now'
        );
        if (configure) {
          vscode.commands.executeCommand('vitals.configureTraceProvider');
        }
        return;
      }

      const serviceName = await vscode.window.showInputBox({
        prompt: 'Enter service name to analyze',
        placeHolder: 'my-service',
      });

      if (!serviceName) {
        return;
      }

      try {
        const now = Date.now();
        const traces = await traceManager.searchTraces({
          serviceName,
          timeRange: {
            start: now - 3600000,
            end: now,
          },
          limit: 50,
        });

        if (traces.length === 0) {
          vscode.window.showInformationMessage(`No traces found for service: ${serviceName}`);
          return;
        }

        // Update CodeLens annotations
        await codeLensProvider.updateAnnotations(serviceName, traces);

        // Show analysis results
        const hotFunctions = profiler.extractHotFunctions(traces[0], serviceName);
        const dbAnalysis = profiler.analyzeDatabaseQueries(traces[0]);

        const outputChannel = vscode.window.createOutputChannel('Vitals Performance Analysis');
        outputChannel.clear();
        outputChannel.appendLine(`Performance Analysis for: ${serviceName}`);
        outputChannel.appendLine(`Analyzed ${traces.length} traces\n`);

        outputChannel.appendLine('🔥 Hot Functions:');
        for (const func of hotFunctions.slice(0, 10)) {
          outputChannel.appendLine(
            `  ${func.name}: ${func.percentage.toFixed(1)}% (${(func.selfTime / 1000).toFixed(2)}ms)`
          );
          if (func.file) {
            outputChannel.appendLine(`    ${func.file}:${func.line}`);
          }
        }

        outputChannel.appendLine(`\nDatabase Queries:`);
        outputChannel.appendLine(`  Total queries: ${dbAnalysis.queryCount}`);
        outputChannel.appendLine(`  Slow queries: ${dbAnalysis.slowQueries.length}`);
        outputChannel.appendLine(`  N+1 patterns: ${dbAnalysis.nPlusOneDetections.length}`);

        if (dbAnalysis.nPlusOneDetections.length > 0) {
          outputChannel.appendLine('\nN+1 Query Patterns Detected:');
          for (const nPlusOne of dbAnalysis.nPlusOneDetections) {
            outputChannel.appendLine(`  ${nPlusOne.query}`);
            outputChannel.appendLine(`    Occurrences: ${nPlusOne.occurrences}`);
            outputChannel.appendLine(`    Total time: ${(nPlusOne.totalDuration / 1000).toFixed(2)}ms`);
            outputChannel.appendLine(`    Suggestion: ${nPlusOne.suggestion}`);
          }
        }

        outputChannel.show();
        vscode.window.showInformationMessage(
          '✅ Performance analysis complete. Check CodeLens annotations in your code!'
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error analyzing performance: ${error.message}`);
      }
    }
  );

  // Register command to show performance details (triggered by CodeLens)
  const showPerformanceDetails = vscode.commands.registerCommand(
    "vitals.showPerformanceDetails",
    async (annotation: any) => {
      const message = `${annotation.message}\n\nValue: ${annotation.metric.value}${annotation.metric.unit}`;
      const actions = ['View Traces'];

      if (annotation.suggestion) {
        actions.push('View Suggestion');
      }

      const selected = await vscode.window.showInformationMessage(message, ...actions);

      if (selected === 'View Traces' && annotation.traceIds) {
        const traces = await Promise.all(
          annotation.traceIds.slice(0, 5).map((id: string) => traceManager.getTrace(id))
        );

        const validTraces = traces.filter((t): t is Trace => t !== undefined);

        if (validTraces.length > 0) {
          vscode.commands.executeCommand('vitals.showTraceDetails', validTraces[0]);
        }
      } else if (selected === 'View Suggestion' && annotation.suggestion) {
        vscode.window.showInformationMessage(annotation.suggestion);
      }
    }
  );

  // Register command to detect regressions
  const detectRegressions = vscode.commands.registerCommand(
    "vitals.detectRegressions",
    async () => {
      usageStats.trackCommand('vitals.detectRegressions');

      if (!traceManager.getActiveProvider()) {
        const configure = await vscode.window.showWarningMessage(
          'No trace provider configured',
          'Configure Now'
        );
        if (configure) {
          vscode.commands.executeCommand('vitals.configureTraceProvider');
        }
        return;
      }

      const serviceName = await vscode.window.showInputBox({
        prompt: 'Enter service name to check for regressions',
        placeHolder: 'my-service',
      });

      if (!serviceName) {
        return;
      }

      try {
        const now = Date.now();
        const regressions = await traceManager.detectRegressions(
          serviceName,
          { start: now - 7200000, end: now - 3600000 }, // 2 hours ago to 1 hour ago (baseline)
          { start: now - 3600000, end: now } // Last hour (current)
        );

        if (regressions.length === 0) {
          vscode.window.showInformationMessage(`No regressions detected for ${serviceName}`);
          return;
        }

        const outputChannel = vscode.window.createOutputChannel('Vitals Regression Detection');
        outputChannel.clear();
        outputChannel.appendLine(`Regression Detection for: ${serviceName}\n`);

        for (const regression of regressions) {
          const icon = regression.severity === 'critical' ? 'Critical' : 'Warning';
          outputChannel.appendLine(`${icon} ${regression.type.toUpperCase()} Regression`);
          outputChannel.appendLine(`  Severity: ${regression.severity}`);
          outputChannel.appendLine(`  Baseline: ${regression.baseline.toFixed(2)}`);
          outputChannel.appendLine(`  Current: ${regression.current.toFixed(2)}`);
          outputChannel.appendLine(`  Change: ${regression.percentChange > 0 ? '+' : ''}${regression.percentChange.toFixed(1)}%`);
          outputChannel.appendLine(`  Root cause: ${regression.rootCause}\n`);
        }

        outputChannel.show();
        vscode.window.showWarningMessage(
          `${regressions.length} regression(s) detected in ${serviceName}`,
          'View Details'
        ).then(selection => {
          if (selection) {
            outputChannel.show();
          }
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to detect regressions: ${error}`);
      }
    }
  );

  // Register incident management commands
  const createIncident = vscode.commands.registerCommand(
    'vitals.createIncident',
    async () => {
      const title = await vscode.window.showInputBox({
        prompt: 'Incident Title',
        placeHolder: 'Brief description of the incident'
      });
      
      if (!title) return;

      const description = await vscode.window.showInputBox({
        prompt: 'Incident Description',
        placeHolder: 'Detailed description'
      });

      if (!description) return;

      const incident = await incidentManager.createIncident({
        title,
        description,
        source: 'manual'
      });

      await integrationManager.notifyIncident(incident);
      
      vscode.window.showInformationMessage(`Incident ${incident.id} created`);
    }
  );

  const showIncident = vscode.commands.registerCommand(
    'vitals.showIncident',
    async (incidentId?: string) => {
      if (!incidentId) {
        const incidents = incidentManager.listIncidents();
        const selected = await vscode.window.showQuickPick(
          incidents.map(i => ({
            label: i.title,
            description: i.severity,
            detail: `Status: ${i.status} | ${i.detectedAt.toLocaleString()}`,
            id: i.id
          }))
        );

        if (!selected) return;
        incidentId = selected.id;
      }

      const incident = incidentManager.getIncident(incidentId);
      if (!incident) {
        vscode.window.showErrorMessage('Incident not found');
        return;
      }

      // Show incident details in webview
      const panel = vscode.window.createWebviewPanel(
        'incidentDetails',
        `Incident: ${incident.title}`,
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .header { border-bottom: 2px solid var(--vscode-panel-border); padding-bottom: 10px; }
            .severity { padding: 5px 10px; border-radius: 3px; display: inline-block; }
            .critical { background: #ff0000; color: white; }
            .high { background: #ff6600; color: white; }
            .medium { background: #ffcc00; }
            .low { background: #00cc00; }
            .timeline { margin-top: 20px; }
            .timeline-entry { margin: 10px 0; padding: 10px; background: var(--vscode-editor-background); }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${incident.title}</h1>
            <p><span class="severity ${incident.severity}">${incident.severity.toUpperCase()}</span></p>
            <p><strong>ID:</strong> ${incident.id}</p>
            <p><strong>Status:</strong> ${incident.status}</p>
            <p><strong>Detected:</strong> ${incident.detectedAt.toLocaleString()}</p>
            ${incident.resolvedAt ? `<p><strong>Resolved:</strong> ${incident.resolvedAt.toLocaleString()}</p>` : ''}
          </div>
          
          <div class="description">
            <h2>Description</h2>
            <p>${incident.description}</p>
          </div>

          <div class="timeline">
            <h2>Timeline</h2>
            ${incident.timeline.map(entry => `
              <div class="timeline-entry">
                <strong>${entry.timestamp.toLocaleTimeString()}</strong> - ${entry.description}
                <br><small>${entry.actor}</small>
              </div>
            `).join('')}
          </div>

          ${incident.hypothesis.length > 0 ? `
            <div class="hypothesis">
              <h2>Hypotheses</h2>
              ${incident.hypothesis.map(h => `
                <div class="timeline-entry">
                  <strong>${h.hypothesis}</strong> - ${h.result}
                  ${h.evidence ? `<br><small>Evidence: ${h.evidence}</small>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </body>
        </html>
      `;
    }
  );

  const executeRunbook = vscode.commands.registerCommand(
    'vitals.executeRunbook',
    async () => {
      const runbooks = runbookEngine.listRunbooks();
      const selected = await vscode.window.showQuickPick(
        runbooks.map(r => ({
          label: r.name,
          description: r.description,
          detail: `Steps: ${r.steps.length}`,
          id: r.id
        }))
      );

      if (!selected) return;

      const execution = await runbookEngine.executeRunbook(selected.id);
      vscode.window.showInformationMessage(`Executing runbook: ${selected.label}`);

      // Monitor execution
      const interval = setInterval(async () => {
        const status = runbookEngine.getExecution(execution.id);
        if (status && (status.status === 'completed' || status.status === 'failed')) {
          clearInterval(interval);
          vscode.window.showInformationMessage(
            `Runbook ${status.status}: ${selected.label}`
          );
        }
      }, 2000);
    }
  );

  const generatePostMortem = vscode.commands.registerCommand(
    'vitals.generatePostMortem',
    async (incidentId?: string) => {
      if (!incidentId) {
        const incidents = incidentManager.listIncidents({ status: IncidentStatus.Resolved });
        const selected = await vscode.window.showQuickPick(
          incidents.map(i => ({
            label: i.title,
            description: i.id,
            id: i.id
          }))
        );

        if (!selected) return;
        incidentId = selected.id;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating post-mortem...',
        cancellable: false
      }, async () => {
        await postMortemGenerator.generatePostMortem(incidentId!);
      });

      vscode.window.showInformationMessage('Post-mortem generated and opened');
    }
  );

  const showOnCallSchedule = vscode.commands.registerCommand(
    'vitals.showOnCallSchedule',
    async () => {
      await onCallManager.showSchedule();
    }
  );

  const configureIntegration = vscode.commands.registerCommand(
    'vitals.configureIntegration',
    async () => {
      const service = await vscode.window.showQuickPick([
        { label: 'PagerDuty', value: 'pagerduty' },
        { label: 'Opsgenie', value: 'opsgenie' },
        { label: 'Slack', value: 'slack' },
        { label: 'Microsoft Teams', value: 'teams' }
      ], {
        placeHolder: 'Select integration to configure'
      });

      if (!service) return;

      await integrationManager.configureIntegration(service.value as any);
      vscode.window.showInformationMessage(`${service.label} configured successfully`);
    }
  );

  const addIncidentAnnotation = vscode.commands.registerCommand(
    'vitals.addIncidentAnnotation',
    async () => {
      const activeIncident = incidentManager.getActiveIncident();
      if (!activeIncident) {
        vscode.window.showWarningMessage('No active incident');
        return;
      }

      const annotation = await vscode.window.showInputBox({
        prompt: 'Add annotation to incident',
        placeHolder: 'What did you observe or try?'
      });

      if (!annotation) return;

      await incidentManager.addAnnotation(activeIncident.id, annotation);
      vscode.window.showInformationMessage('Annotation added');
    }
  );

  const addIncidentHypothesis = vscode.commands.registerCommand(
    'vitals.addIncidentHypothesis',
    async () => {
      const activeIncident = incidentManager.getActiveIncident();
      if (!activeIncident) {
        vscode.window.showWarningMessage('No active incident');
        return;
      }

      const hypothesis = await vscode.window.showInputBox({
        prompt: 'Add hypothesis',
        placeHolder: 'What do you think is causing this?'
      });

      if (!hypothesis) return;

      await incidentManager.addHypothesis(activeIncident.id, hypothesis);
      vscode.window.showInformationMessage('Hypothesis added');
    }
  );

  // Register CI/CD integration commands
  const trackDeployment = vscode.commands.registerCommand(
    'vitals.trackDeployment',
    async () => {
      const version = await vscode.window.showInputBox({
        prompt: 'Deployment Version',
        placeHolder: 'e.g., v1.2.3'
      });
      
      if (!version) return;

      const environment = await vscode.window.showQuickPick(
        ['production', 'staging', 'development'],
        { placeHolder: 'Select environment' }
      );

      if (!environment) return;

      await deploymentTracker.registerDeployment({
        version,
        environment,
        commitSha: 'HEAD',
        commitMessage: 'Manual deployment',
        author: 'current-user'
      });
    }
  );

  const viewDeployments = vscode.commands.registerCommand(
    'vitals.viewDeployments',
    async () => {
      const deployments = deploymentTracker.listDeployments({ limit: 20 });
      
      const selected = await vscode.window.showQuickPick(
        deployments.map(d => ({
          label: `${d.version} (${d.environment})`,
          description: `${d.status} - ${d.timestamp.toLocaleString()}`,
          deployment: d
        })),
        { placeHolder: 'Select deployment to view details' }
      );

      if (selected) {
        cicdOutputChannel.show();
        cicdOutputChannel.appendLine(`\n=== Deployment Details ===`);
        cicdOutputChannel.appendLine(`Version: ${selected.deployment.version}`);
        cicdOutputChannel.appendLine(`Environment: ${selected.deployment.environment}`);
        cicdOutputChannel.appendLine(`Status: ${selected.deployment.status}`);
        cicdOutputChannel.appendLine(`Timestamp: ${selected.deployment.timestamp.toLocaleString()}`);
        cicdOutputChannel.appendLine(`Commit: ${selected.deployment.commitSha}`);
        cicdOutputChannel.appendLine(`Author: ${selected.deployment.author}`);
      }
    }
  );

  const analyzeDeploymentImpact = vscode.commands.registerCommand(
    'vitals.analyzeDeploymentImpact',
    async () => {
      const deployments = deploymentTracker.listDeployments({ limit: 10 });
      
      const selected = await vscode.window.showQuickPick(
        deployments.map(d => ({
          label: d.version,
          description: d.environment,
          deployment: d
        })),
        { placeHolder: 'Select deployment to analyze' }
      );

      if (!selected) return;

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing deployment impact...',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 50 });
        
        // Mock metrics
        const preMetrics = [
          { metricName: 'response_time', timestamp: new Date(), value: 180 },
          { metricName: 'error_rate', timestamp: new Date(), value: 0.025 }
        ];
        const postMetrics = [
          { metricName: 'response_time', timestamp: new Date(), value: 165 },
          { metricName: 'error_rate', timestamp: new Date(), value: 0.018 }
        ];

        const impacts = await performanceImpactAnalyzer.analyzeDeployment(
          selected.deployment,
          preMetrics,
          postMetrics
        );

        progress.report({ increment: 100 });

        cicdOutputChannel.show();
        cicdOutputChannel.appendLine(`\n=== Performance Impact Analysis ===`);
        impacts.forEach(impact => {
          cicdOutputChannel.appendLine(`${impact.metricName}: ${impact.details}`);
        });
      });
    }
  );

  const rollbackDeployment = vscode.commands.registerCommand(
    'vitals.rollbackDeployment',
    async () => {
      const deployments = deploymentTracker.listDeployments({ limit: 5 });
      
      const selected = await vscode.window.showQuickPick(
        deployments.map(d => ({
          label: `Rollback from ${d.version}`,
          description: d.environment,
          deployment: d
        })),
        { placeHolder: 'Select deployment to rollback' }
      );

      if (!selected) return;

      const targetVersion = await vscode.window.showInputBox({
        prompt: 'Target version to rollback to',
        placeHolder: 'e.g., v1.2.2'
      });

      if (!targetVersion) return;

      const result = await rollbackEngine.executeRollback(
        selected.deployment,
        targetVersion
      );

      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      }
    }
  );

  const viewBuildTrends = vscode.commands.registerCommand(
    'vitals.viewBuildTrends',
    async () => {
      const repository = await vscode.window.showInputBox({
        prompt: 'Repository name',
        placeHolder: 'e.g., myorg/myrepo'
      });

      if (!repository) return;

      const branch = await vscode.window.showInputBox({
        prompt: 'Branch name',
        placeHolder: 'e.g., main',
        value: 'main'
      });

      if (!branch) return;

      const trends = ciPipelineMonitor.analyzeBuildTrends(repository, branch);
      
      cicdOutputChannel.show();
      cicdOutputChannel.appendLine(`\n=== Build Trends: ${repository}/${branch} ===`);
      cicdOutputChannel.appendLine(`Average Duration: ${(trends.averageDuration / 1000).toFixed(1)}s`);
      cicdOutputChannel.appendLine(`Trend: ${trends.trendDirection}`);
      cicdOutputChannel.appendLine(`\nSlowest Stages:`);
      trends.slowestStages.forEach((stage, i) => {
        cicdOutputChannel.appendLine(`${i + 1}. ${stage.name}: ${(stage.averageDuration / 1000).toFixed(1)}s`);
      });
      cicdOutputChannel.appendLine(`\nRecommendations:`);
      trends.recommendations.forEach(rec => {
        cicdOutputChannel.appendLine(`- ${rec}`);
      });
    }
  );

  const viewFlakyTests = vscode.commands.registerCommand(
    'vitals.viewFlakyTests',
    async () => {
      const flakyTests = ciPipelineMonitor.getFlakyTests();
      
      if (flakyTests.length === 0) {
        vscode.window.showInformationMessage('No flaky tests detected');
        return;
      }

      cicdOutputChannel.show();
      cicdOutputChannel.appendLine(`\n=== Flaky Tests Report ===`);
      cicdOutputChannel.appendLine(`Found ${flakyTests.length} flaky test(s)\n`);
      
      flakyTests.forEach((test, i) => {
        cicdOutputChannel.appendLine(`${i + 1}. ${test.testName}`);
        cicdOutputChannel.appendLine(`   Failure Rate: ${(test.failureRate * 100).toFixed(1)}%`);
        cicdOutputChannel.appendLine(`   Total Runs: ${test.totalRuns}`);
        cicdOutputChannel.appendLine(`   Recommendation: ${test.recommendedAction}\n`);
      });
    }
  );

  const connectFeatureFlagProvider = vscode.commands.registerCommand(
    'vitals.connectFeatureFlagProvider',
    async () => {
      const provider = await vscode.window.showQuickPick(
        ['LaunchDarkly', 'Split.io', 'Unleash'],
        { placeHolder: 'Select feature flag provider' }
      );

      if (!provider) return;

      const apiKey = await vscode.window.showInputBox({
        prompt: 'API Key',
        password: true
      });

      if (!apiKey) return;

      const providerMap: Record<string, any> = {
        'LaunchDarkly': 'launchdarkly',
        'Split.io': 'splitio',
        'Unleash': 'unleash'
      };

      await featureFlagManager.connectProvider(providerMap[provider], { apiKey });
    }
  );

  const analyzeFlagImpact = vscode.commands.registerCommand(
    'vitals.analyzeFlagImpact',
    async () => {
      const flags = featureFlagManager.listFlags();
      
      if (flags.length === 0) {
        vscode.window.showInformationMessage('No feature flags found. Connect a provider first.');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        flags.map(f => ({
          label: f.name,
          description: `${f.rolloutPercentage}% rollout`,
          flag: f
        })),
        { placeHolder: 'Select feature flag to analyze' }
      );

      if (!selected) return;

      const analysis = await featureFlagManager.analyzeFlagImpact(selected.flag.key);
      
      if (analysis) {
        cicdOutputChannel.show();
        cicdOutputChannel.appendLine(`\n=== Flag Impact Analysis: ${selected.flag.key} ===`);
        cicdOutputChannel.appendLine(`Rollout: ${selected.flag.rolloutPercentage}%`);
        cicdOutputChannel.appendLine(`Affected Users: ${analysis.userImpact.affectedUsers.toLocaleString()}`);
        cicdOutputChannel.appendLine(`Recommendation: ${analysis.recommendation}`);
      }
    }
  );

  const generateReleaseNotes = vscode.commands.registerCommand(
    'vitals.generateReleaseNotes',
    async () => {
      const deployments = deploymentTracker.listDeployments({ limit: 10 });
      
      const selected = await vscode.window.showQuickPick(
        deployments.map(d => ({
          label: d.version,
          description: `${d.environment} - ${d.timestamp.toLocaleString()}`,
          deployment: d
        })),
        { placeHolder: 'Select deployment for release notes' }
      );

      if (!selected) return;

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating release notes...',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 50 });
        
        const allDeployments = deploymentTracker.listDeployments();
        const previousDeployment = allDeployments.find(
          d => d.environment === selected.deployment.environment && 
               d.timestamp < selected.deployment.timestamp
        );

        const releaseNotes = await releaseNotesGenerator.generateReleaseNotes(
          selected.deployment,
          previousDeployment
        );

        progress.report({ increment: 100 });

        vscode.window.showInformationMessage(
          'Release notes generated and opened in editor'
        );
      });
    }
  );

  // Add the commands to the extension's context subscriptions
  context.subscriptions.push(
    openDashboard, 
    signOut, 
    showStatus, 
    signIn,
    configurePrometheus,
    configureCloudProvider,
    viewCostMetrics,
    configureTraceProvider,
    searchTraces,
    showTraceDetails,
    viewServiceMap,
    analyzePerformance,
    showPerformanceDetails,
    detectRegressions,
    createIncident,
    showIncident,
    executeRunbook,
    generatePostMortem,
    showOnCallSchedule,
    configureIntegration,
    addIncidentAnnotation,
    addIncidentHypothesis,
    trackDeployment,
    viewDeployments,
    analyzeDeploymentImpact,
    rollbackDeployment,
    viewBuildTrends,
    viewFlakyTests,
    connectFeatureFlagProvider,
    analyzeFlagImpact,
    generateReleaseNotes,
    onCallManager,
    outputChannel
  );

  console.log('✅ Vitals extension activated successfully');
}

// Called when the extension is deactivated
export function deactivate() {
  console.log("Vitals extension deactivated");
}

