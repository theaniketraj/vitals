import * as vscode from "vscode";

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export class GitHubAuthProvider {
  private static readonly AUTH_TYPE = "github";
  private static readonly SCOPES = ["user:email"];
  private static session: vscode.AuthenticationSession | undefined;

  /**
   * Sign in with GitHub using VS Code's built-in authentication
   */
  static async signIn(): Promise<GitHubUser | undefined> {
    try {
      // Request authentication from GitHub
      const session = await vscode.authentication.getSession(
        this.AUTH_TYPE,
        this.SCOPES,
        { createIfNone: true },
      );

      if (!session) {
        vscode.window.showErrorMessage("GitHub authentication failed");
        return undefined;
      }

      this.session = session;

      // Fetch user details from GitHub API
      const user = await this.fetchUserDetails(session.accessToken);

      if (user) {
        vscode.window.showInformationMessage(
          `Welcome, ${user.name || user.login}! 🎉`,
        );
      }

      return user;
    } catch (error) {
      vscode.window.showErrorMessage(`GitHub sign-in failed: ${error}`);
      return undefined;
    }
  }

  /**
   * Check if user is already signed in
   */
  static async isSignedIn(): Promise<boolean> {
    try {
      const session = await vscode.authentication.getSession(
        this.AUTH_TYPE,
        this.SCOPES,
        { createIfNone: false },
      );

      this.session = session;
      return !!session;
    } catch {
      return false;
    }
  }

  /**
   * Get current session
   */
  static async getSession(): Promise<vscode.AuthenticationSession | undefined> {
    if (this.session) {
      return this.session;
    }

    try {
      const session = await vscode.authentication.getSession(
        this.AUTH_TYPE,
        this.SCOPES,
        { createIfNone: false },
      );

      this.session = session;
      return session;
    } catch {
      return undefined;
    }
  }

  /**
   * Sign out from GitHub
   */
  static async signOut(): Promise<void> {
    if (this.session) {
      // Note: VS Code doesn't provide a direct sign-out API
      // User must sign out through VS Code's Accounts menu
      this.session = undefined;
      vscode.window.showInformationMessage(
        "Please sign out from GitHub through VS Code Accounts menu (bottom left)",
      );
    }
  }

  /**
   * Fetch user details from GitHub API
   */
  private static async fetchUserDetails(
    accessToken: string,
  ): Promise<GitHubUser | undefined> {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "VSCode-Vitals-Extension",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: data.email,
        avatar_url: data.avatar_url,
      };
    } catch (error) {
      console.error("Failed to fetch GitHub user details:", error);
      return undefined;
    }
  }

  /**
   * Get current user details
   */
  static async getCurrentUser(): Promise<GitHubUser | undefined> {
    const session = await this.getSession();
    if (!session) {
      return undefined;
    }

    return this.fetchUserDetails(session.accessToken);
  }
}
