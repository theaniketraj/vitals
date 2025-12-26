import axios from "axios";

export interface LokiLogEntry {
    timestamp: string; // Nanoseconds as string or ISO
    line: string;
    labels?: Record<string, string>;
}

export class LokiApi {
    private readonly baseUrl: string;
    private readonly timeout = 5000;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }

    /**
     * Fetches logs from Loki over a time range.
     * @param query The LogQL query string (e.g., '{job="varlogs"}').
     * @param start Start timestamp in nanoseconds (or seconds/ISO depending on Loki version, usually ns strings or seconds).
     * @param end End timestamp in nanoseconds.
     * @param limit Max number of entries to return.
     */
    public async queryRange(query: string, start: number, end: number, limit: number = 100): Promise<LokiLogEntry[]> {
        const url = `${this.baseUrl}/loki/api/v1/query_range`;

        // Loki expects timestamps in nanoseconds for precision, but accepts seconds or ISO too.
        // We'll use nanoseconds (string) to avoid precision loss if possible, 
        // or just pass the start/end as provided (assuming sender formats them right).
        // For simplicity with standard JS Dates: start/end are usually ms or seconds. 
        // Loki API: start=<time>, end=<time>. <time> can be RFC3339 or Unix timestamp.
        // We'll use RFC3339 ISO strings if passed, or numbers.

        // Actually, converting to nanoseconds string is safest for Loki.
        const startNs = BigInt(Math.floor(start * 1000)) * BigInt(1000000);
        const endNs = BigInt(Math.floor(end * 1000)) * BigInt(1000000);

        try {
            const response = await axios.get(url, {
                params: {
                    query,
                    start: startNs.toString(),
                    end: endNs.toString(),
                    limit,
                    direction: 'backward' // Newest first
                },
                timeout: this.timeout
            });

            if (response.status !== 200) {
                throw new Error(`Loki API error: ${response.statusText}`);
            }

            const result = response.data?.data?.result;
            if (!Array.isArray(result)) {
                return [];
            }

            // Parse Loki response structure:
            // result: [{ stream: { labels }, values: [[ts, line], ...] }, ...]
            const logs: LokiLogEntry[] = [];

            for (const stream of result) {
                const labels = stream.stream;
                for (const value of stream.values) {
                    // value: [timestamp_ns_string, log_line]
                    logs.push({
                        timestamp: value[0],
                        line: value[1],
                        labels
                    });
                }
            }

            // Sort by timestamp descending (newest first) since we might merge multiple streams
            return logs.sort((a, b) => {
                if (a.timestamp < b.timestamp) return 1;
                if (a.timestamp > b.timestamp) return -1;
                return 0;
            });

        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Loki Network error: ${error.message}`);
            }
            throw error;
        }
    }

    public async testConnection(): Promise<boolean> {
        try {
            const url = `${this.baseUrl}/ready`;
            const response = await axios.get(url, { timeout: 2000 });
            return response.status === 200;
        } catch (e) {
            return false;
        }
    }
}
