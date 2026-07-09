import * as vscode from "vscode";
import axios from "axios";
import { vitalsApi } from "../api/vitalsApi";

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export class CustomGitHubAuth {
  private static readonly AUTH_TYPE = "github";
  private static readonly SCOPES = ["user:email", "read:user"];
  private static currentUser: GitHubUser | undefined;

  /**
   * Initialize OAuth flow using VS Code's native authentication
   */
  static async signIn(
    context: vscode.ExtensionContext,
  ): Promise<GitHubUser | undefined> {
    try {
      console.log("🔑 Starting GitHub sign-in flow (Native)...");

      const session = await vscode.authentication.getSession(
        this.AUTH_TYPE,
        this.SCOPES,
        { createIfNone: true },
      );

      if (!session) {
        console.log("❌ GitHub authentication failed or cancelled");
        return undefined;
      }

      console.log("✅ GitHub authentication successful");

      // Fetch user details
      const user = await this.fetchUserDetails(session.accessToken);

      if (user) {
        this.currentUser = user;

        // Mark authentication as completed
        await context.globalState.update("vitals.authWall.completed", true);

        // Sync user to backend
        try {
          const githubId = String(user.id);
          console.log("Syncing user to backend:", githubId, user.login);
          await vitalsApi.createUser(githubId, user.login, user.email);
          console.log("✅ User synced to backend");
        } catch (error) {
          console.error("Failed to sync user to backend:", error);
        }

        vscode.window.showInformationMessage(
          `Welcome, ${user.name || user.login}! 🎉`,
        );
      }

      return user;
    } catch (error) {
      vscode.window.showErrorMessage(`GitHub sign-in failed: ${error}`);
      console.error("Sign-in error:", error);
      return undefined;
    }
  }

  /**
   * Configure GitHub OAuth credentials - DEPRECATED
   * Kept for compatibility but does nothing now as we use native auth
   */
  static async configureCredentials(
    context: vscode.ExtensionContext,
  ): Promise<boolean> {
    vscode.window.showInformationMessage(
      "Custom credentials are no longer needed. Vitals now uses VS Code's built-in GitHub authentication.",
    );
    return true;
  }

  /**
   * Fetch user details from GitHub API
   */
  private static async fetchUserDetails(
    token: string,
  ): Promise<GitHubUser | undefined> {
    try {
      const response = await axios.get("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "Vitals-VSCode-Extension",
        },
      });

      const data = response.data;

      // Fetch email if not public
      let email = data.email;
      if (!email) {
        try {
          const emailRes = await axios.get(
            "https://api.github.com/user/emails",
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "User-Agent": "Vitals-VSCode-Extension",
              },
            },
          );

          const emails = emailRes.data;
          const primary = emails.find((e: any) => e.primary && e.verified);
          if (primary) {
            email = primary.email;
          }
        } catch (e) {
          console.warn("Failed to fetch emails:", e);
        }
      }

      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: email,
        avatar_url: data.avatar_url,
      };
    } catch (error) {
      console.error("Failed to fetch GitHub user details:", error);
      return undefined;
    }
  }

  /**
   * Check if user is signed in
   */
  static async isSignedIn(context: vscode.ExtensionContext): Promise<boolean> {
    try {
      const session = await vscode.authentication.getSession(
        this.AUTH_TYPE,
        this.SCOPES,
        { createIfNone: false },
      );
      return !!session;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get current session token
   */
  static async getAccessToken(
    context: vscode.ExtensionContext,
  ): Promise<string | undefined> {
    try {
      const session = await vscode.authentication.getSession(
        this.AUTH_TYPE,
        this.SCOPES,
        { createIfNone: false },
      );
      return session?.accessToken;
    } catch (e) {
      return undefined;
    }
  }

  /**
   * Get current user
   */
  static async getCurrentUser(
    context: vscode.ExtensionContext,
  ): Promise<GitHubUser | undefined> {
    if (this.currentUser) {
      return this.currentUser;
    }

    // Fetch fresh data
    const token = await this.getAccessToken(context);
    if (!token) {
      return undefined;
    }

    const user = await this.fetchUserDetails(token);
    if (user) {
      this.currentUser = user;
    }

    return user;
  }

  /**
   * Sign out
   */
  static async signOut(context: vscode.ExtensionContext): Promise<void> {
    this.currentUser = undefined;
    await context.globalState.update("vitals.authWall.completed", false);

    vscode.window.showInformationMessage(
      "Signed out from Vitals. To fully disconnect GitHub, manage your Trusted Extensions in VS Code settings.",
    );
  }
}
