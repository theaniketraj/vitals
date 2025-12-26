import * as vscode from "vscode";

export * from "./api/PrometheusApi";
export * from "./api/IDataSource";
export * from "./api/DataSourceManager";
export * from "./api/AlertmanagerApi";
export * from "./api/LokiApi";

export enum MessageTypes {
  TRIGGER_ALERT = "TRIGGER_ALERT",
  UPDATE_METRICS = "UPDATE_METRICS",
  UPDATE_LOGS = "UPDATE_LOGS",
}

export function sendMessageToWebview(webview: vscode.Webview, message: any) {
  webview.postMessage(message);
}
