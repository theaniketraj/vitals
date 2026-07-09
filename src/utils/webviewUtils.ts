import * as vscode from "vscode";
// import * as fs from "node:fs";

export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  // TEMPORARY: Load integration test suite
  // To revert, comment out these two lines and uncomment the block below
  // const testFilePath = vscode.Uri.joinPath(extensionUri, "connectivity-test.html").fsPath;
  // return fs.readFileSync(testFilePath, "utf-8");

  /* Original Webview Content */
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "webview", "build", "bundle.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "webview", "build", "styles.css"),
  );

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-eval';">
      <link rel="stylesheet" href="${styleUri}">
      <title>Vitals</title>
    </head>
    <body>
      <div id="root"></div>
      <script src="${scriptUri}"></script>
    </body>
    </html>
  `;
}
