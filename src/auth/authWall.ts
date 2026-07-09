import * as vscode from "vscode";
import { CustomGitHubAuth } from "./customGitHubAuth";
import { vitalsApi } from "../api/vitalsApi";

export class AuthWall {
  private static readonly AUTH_WALL_KEY = "vitals.authWall.completed";

  /**
   * Check if user has completed authentication
   */
  static async isAuthenticated(
    context: vscode.ExtensionContext,
  ): Promise<boolean> {
    // Check if token exists and is valid
    const isSignedIn = await CustomGitHubAuth.isSignedIn(context);
    if (!isSignedIn) {
      return false;
    }

    // If signed in, verify we have user data (confirms valid session)
    const user = await CustomGitHubAuth.getCurrentUser(context);
    if (!user) {
      // Token exists but invalid - clear it
      await this.reset(context);
      return false;
    }

    // Valid session found - ensure completion flag is set
    const authCompleted = context.globalState.get<boolean>(
      this.AUTH_WALL_KEY,
      false,
    );
    if (!authCompleted) {
      await context.globalState.update(this.AUTH_WALL_KEY, true);
    }

    return true;
  }

  /**
   * Show authentication wall for new users
   * Returns true if authentication successful, false otherwise
   */
  static async showAuthWall(
    context: vscode.ExtensionContext,
  ): Promise<boolean> {
    // Check if already authenticated
    if (await this.isAuthenticated(context)) {
      return true;
    }

    // Show welcome message with authentication requirement
    const selection = await vscode.window.showInformationMessage(
      "Welcome to Vitals! To get started, please sign in with your GitHub account.",
      { modal: true },
      "Sign In with GitHub",
      "Learn More",
    );

    if (selection === "Learn More") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://github.com/theaniketraj/vitals#readme"),
      );
      // Show the prompt again after they come back
      return this.showAuthWall(context);
    }

    if (selection !== "Sign In with GitHub") {
      vscode.window.showWarningMessage(
        'Vitals requires GitHub authentication to continue. You can sign in anytime using the command: "Vitals: Sign In with GitHub"',
      );
      return false;
    }

    // Start authentication flow
    const user = await CustomGitHubAuth.signIn(context);

    if (!user) {
      console.log("❌ GitHub authentication failed or cancelled");

      const retry = await vscode.window.showWarningMessage(
        "GitHub authentication is required to use Vitals.",
        "Try Again",
        "Later",
      );

      if (retry === "Try Again") {
        return this.showAuthWall(context);
      }

      return false;
    }

    // Mark authentication as completed
    await context.globalState.update(this.AUTH_WALL_KEY, true);

    // Log sign-in event to backend
    try {
      await vitalsApi.logEvent(user.id.toString(), "user_signed_in", {
        username: user.login,
      });
    } catch (error) {
      console.error("Failed to log sign-in event:", error);
    }

    // Show success message
    vscode.window
      .showInformationMessage(
        `✅ Successfully signed in as ${user.name || user.login}!`,
        "Open Dashboard",
      )
      .then((selection) => {
        if (selection === "Open Dashboard") {
          // Use setTimeout to break out of the current call stack
          // This prevents the infinite loop when opening dashboard after auth
          setTimeout(() => {
            vscode.commands.executeCommand("vitals.openDashboard");
          }, 100);
        }
      });

    return true;
  }

  /**
   * Enforce authentication wall - blocks until user authenticates
   */
  static async enforce(context: vscode.ExtensionContext): Promise<boolean> {
    console.log("🔐 AuthWall.enforce() called");

    // Check if already authenticated
    const isAuth = await this.isAuthenticated(context);
    console.log(`🔐 isAuthenticated check: ${isAuth}`);

    if (isAuth) {
      console.log("✅ User already authenticated");
      return true;
    }

    // Show auth wall
    console.log("⚠️ User not authenticated, showing auth wall");
    const result = await this.showAuthWall(context);
    console.log(`🔐 showAuthWall result: ${result}`);
    return result;
  }

  /**
   * Reset authentication wall (for testing or sign out)
   */
  static async reset(context: vscode.ExtensionContext): Promise<void> {
    await context.globalState.update(this.AUTH_WALL_KEY, false);
    await CustomGitHubAuth.signOut(context);
  }

  /**
   * Check authentication status silently (no prompts)
   */
  static async checkStatus(context: vscode.ExtensionContext): Promise<{
    isSignedIn: boolean;
    authCompleted: boolean;
    user?: any;
  }> {
    const isSignedIn = await CustomGitHubAuth.isSignedIn(context);
    const authCompleted = context.globalState.get<boolean>(
      this.AUTH_WALL_KEY,
      false,
    );
    let user = undefined;

    if (isSignedIn) {
      user = await CustomGitHubAuth.getCurrentUser(context);
    }

    return {
      isSignedIn,
      authCompleted,
      user,
    };
  }
}
