import * as vscode from "vscode";

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export class SecureStorage {
  private static readonly CLIENT_ID_KEY = "vitals.github.clientId";
  private static readonly CLIENT_SECRET_KEY = "vitals.github.clientSecret";

  /**
   * Store GitHub OAuth credentials securely
   */
  static async storeCredentials(
    context: vscode.ExtensionContext,
    credentials: OAuthCredentials,
  ): Promise<void> {
    try {
      // Store Client ID in global state (not sensitive)
      await context.globalState.update(
        this.CLIENT_ID_KEY,
        credentials.clientId,
      );

      // Store Client Secret in VS Code's secure secret storage
      await context.secrets.store(
        this.CLIENT_SECRET_KEY,
        credentials.clientSecret,
      );

      vscode.window.showInformationMessage(
        "GitHub OAuth credentials saved securely ✅",
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to store credentials: ${error}`);
      throw error;
    }
  }

  /**
   * Retrieve stored GitHub OAuth credentials
   */
  static async getCredentials(
    context: vscode.ExtensionContext,
  ): Promise<OAuthCredentials | undefined> {
    try {
      const clientId = context.globalState.get<string>(this.CLIENT_ID_KEY);
      const clientSecret = await context.secrets.get(this.CLIENT_SECRET_KEY);

      if (!clientId || !clientSecret) {
        return undefined;
      }

      return { clientId, clientSecret };
    } catch (error) {
      console.error("Failed to retrieve credentials:", error);
      return undefined;
    }
  }

  /**
   * Check if credentials are configured
   */
  static async hasCredentials(
    context: vscode.ExtensionContext,
  ): Promise<boolean> {
    const credentials = await this.getCredentials(context);
    return !!credentials;
  }

  /**
   * Clear stored credentials
   */
  static async clearCredentials(
    context: vscode.ExtensionContext,
  ): Promise<void> {
    await context.globalState.update(this.CLIENT_ID_KEY, undefined);
    await context.secrets.delete(this.CLIENT_SECRET_KEY);
    vscode.window.showInformationMessage("GitHub OAuth credentials cleared");
  }
}
