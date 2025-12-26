import * as React from "react";
import { Alert, Silence } from "../hooks/useAlertmanager";

interface AlertmanagerPanelProps {
    alerts: Alert[];
    silences: Silence[];
    loading: boolean;
    error: string | null;
    onCreateSilence: (silence: any) => void;
}

const AlertmanagerPanel: React.FC<AlertmanagerPanelProps> = ({
    alerts,
    silences,
    loading,
    error,
    onCreateSilence,
}) => {
    const [selectedAlert, setSelectedAlert] = React.useState<Alert | null>(null);
    const [showSilenceForm, setShowSilenceForm] = React.useState(false);

    // Form state
    const [author, setAuthor] = React.useState("vitals-user");
    const [comment, setComment] = React.useState("");
    const [duration, setDuration] = React.useState(2); // hours

    const handleSilenceClick = (alert: Alert) => {
        setSelectedAlert(alert);
        setShowSilenceForm(true);
        // Auto-fill comment likely
        setComment(`Silencing alert ${alert.labels.alertname}`);
    };

    const handleSubmitSilence = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAlert) return;

        const now = new Date();
        const end = new Date(now.getTime() + duration * 60 * 60 * 1000);

        const silence = {
            matchers: Object.entries(selectedAlert.labels).map(([name, value]) => ({
                name,
                value,
                isRegex: false
            })),
            startsAt: now.toISOString(),
            endsAt: end.toISOString(),
            createdBy: author,
            comment,
        };

        onCreateSilence(silence);
        setShowSilenceForm(false);
        setSelectedAlert(null);
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;
    if (error) return <div className="error-message">Error: {error}</div>;

    return (
        <div className="alertmanager-panel">
            {/* Alert List */}
            <div className="alert-list-section">
                <h3>Active Alerts ({alerts.length})</h3>
                <div className="alert-list">
                    {alerts.map((alert, idx) => (
                        <div key={idx} className={`alert-item ${alert.status.state}`}>
                            <div className="alert-header">
                                <span className="alert-name">{alert.labels.alertname}</span>
                                <span className={`alert-severity ${alert.labels.severity}`}>
                                    {alert.labels.severity || "unknown"}
                                </span>
                                <button
                                    className="silence-btn"
                                    onClick={() => handleSilenceClick(alert)}
                                    disabled={alert.status.state === 'suppressed'}
                                >
                                    {alert.status.state === 'suppressed' ? 'Silenced' : 'Silence'}
                                </button>
                            </div>
                            <div className="alert-annotations">
                                {alert.annotations.description || alert.annotations.summary}
                            </div>
                            <div className="alert-labels">
                                {Object.entries(alert.labels).map(([k, v]) => (
                                    <span key={k} className="label-tag">{k}={v}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Silences List */}
            <div className="silence-list-section">
                <h3>Active Silences ({silences.filter(s => s.status.state === 'active').length})</h3>
                <div className="silence-list">
                    {silences.filter(s => s.status.state === 'active').map((silence) => (
                        <div key={silence.id} className="silence-item">
                            <span className="silence-id" title={silence.id}>{silence.id.substring(0, 8)}...</span>
                            <span className="silence-comment">{silence.comment}</span>
                            <span className="silence-time">Ends: {new Date(silence.endsAt).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Silence Modal */}
            {showSilenceForm && selectedAlert && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Silence Alert: {selectedAlert.labels.alertname}</h3>
                        <form onSubmit={handleSubmitSilence}>
                            <div className="form-group">
                                <label>Author</label>
                                <input
                                    type="text"
                                    value={author}
                                    onChange={(e) => setAuthor(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Comment</label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Duration (Hours)</label>
                                <input
                                    type="number"
                                    value={duration}
                                    onChange={(e) => setDuration(Number(e.target.value))}
                                    min="0.1"
                                    step="0.1"
                                    required
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowSilenceForm(false)}>Cancel</button>
                                <button type="submit" className="primary-btn">Create Silence</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlertmanagerPanel;
