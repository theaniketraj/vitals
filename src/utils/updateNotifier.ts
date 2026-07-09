import * as vscode from "vscode";

export async function checkVersionUpdate(context: vscode.ExtensionContext) {
  const extensionId = "theaniketraj.vitals";
  const extension = vscode.extensions.getExtension(extensionId);

  if (!extension) {
    return;
  }

  const currentVersion = extension.packageJSON.version;
  const previousVersion = context.globalState.get<string>("vitals.version");

  if (currentVersion !== previousVersion) {
    // Update stored version
    await context.globalState.update("vitals.version", currentVersion);

    // If it's not a fresh install (previousVersion exists), show update notification
    if (previousVersion) {
      const action = "View Changelog";
      const message = `Vitals has been updated to version ${currentVersion}!`;

      vscode.window
        .showInformationMessage(message, action)
        .then((selection) => {
          if (selection === action) {
            vscode.env.openExternal(
              vscode.Uri.parse(
                "https://github.com/theaniketraj/vitals/blob/main/changelog.md",
              ),
            );
          }
        });
    }
  }
}
