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
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error detecting regressions: ${error.message}`);
      }
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
    detectRegressions
  );

  console.log('✅ Commands registered successfully');
}

// Called when the extension is deactivated
export function deactivate() {
  console.log("Vitals extension deactivated");
}
