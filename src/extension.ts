// Main entry point for the VS Code extension
import * as vscode from "vscode";
import { VitalsViewProvider } from "./vitalsView";
import { CustomGitHubAuth } from "./auth/customGitHubAuth";
import { AuthWall } from "./auth/authWall";
import { vitalsApi } from "./api/vitalsApi";
import { getUsageStats } from "./telemetry/usageStats";
import { checkVersionUpdate } from "./utils/updateNotifier";

// Called when the extension is activated (e.g., when a command is executed)
export async function activate(context: vscode.ExtensionContext) {
  // Log activation for debugging
  console.log("🚀 Vitals extension activated");

  // Check for updates
  checkVersionUpdate(context);

  // Initialize usage statistics collector
  const usageStats = getUsageStats(context);

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
      // This would open a webview with cost metrics
      provider.show();
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
    viewCostMetrics
  );

  console.log('✅ Commands registered successfully');
}

// Called when the extension is deactivated
export function deactivate() {
  console.log("Vitals extension deactivated");
}
