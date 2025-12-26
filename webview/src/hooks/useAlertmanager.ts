import { useState, useEffect } from "react";

export interface Alert {
    labels: Record<string, string>;
    annotations: Record<string, string>;
    startsAt: string;
    endsAt: string;
    generatorURL: string;
    status: {
        state: string;
        silencedBy: string[];
        inhibitedBy: string[];
    };
}

export interface Silence {
    id: string;
    matchers: {
        name: string;
        value: string;
        isRegex: boolean;
    }[];
    startsAt: string;
    endsAt: string;
    createdBy: string;
    comment: string;
    status: {
        state: string;
    };
}

export const useAlertmanager = (vscode: any) => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [silences, setSilences] = useState<Silence[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Initial fetch
        vscode.postMessage({ command: "fetchAlertmanagerData" });

        const messageHandler = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case "updateAlertmanagerData":
                    setAlerts(message.data.alerts);
                    setSilences(message.data.silences);
                    setLoading(false);
                    setError(null);
                    break;
                case "alertmanagerError":
                    setError(message.message);
                    setLoading(false);
                    break;
                case "silenceCreated":
                    // Refresh data after silence
                    vscode.postMessage({ command: "fetchAlertmanagerData" });
                    break;
            }
        };

        window.addEventListener("message", messageHandler);

        // Periodically refresh
        const intervalId = setInterval(() => {
            vscode.postMessage({ command: "fetchAlertmanagerData" });
        }, 10000);

        return () => {
            window.removeEventListener("message", messageHandler);
            clearInterval(intervalId);
        };
    }, [vscode]);

    const createSilence = (silence: any) => {
        vscode.postMessage({
            command: "createSilence",
            data: silence
        });
    };

    return { alerts, silences, loading, error, createSilence };
};
