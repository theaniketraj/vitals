import axios from "axios";
import { IDataSource } from "./IDataSource";

export class PrometheusApi implements IDataSource {
    private readonly baseUrl: string;
    private readonly timeout = 5000;
    private readonly maxRetries = 3;

    constructor(baseUrl: string) {
        // Remove trailing slash and any path like /query or /api/v1/query
        this.baseUrl = baseUrl.replace(/\/$/, "").replace(/\/query$/, "").replace(/\/api\/v1\/query$/, "");
    }

    public async testConnection(): Promise<boolean> {
        try {
            const url = `${this.baseUrl}/api/v1/status/config`;
            await this.performRequest(url);
            return true;
        } catch (error) {
            return false;
        }
    }

    private async requestWithRetry(url: string, params?: any): Promise<any> {
        let lastError: any;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.performRequest(url, params);
            } catch (error: any) {
                lastError = error;

                if (this.shouldStopRetrying(error)) {
                    throw this.enhanceError(error);
                }

                // If it's the last attempt, throw the error
                if (attempt === this.maxRetries) {
                    throw this.enhanceError(error);
                }

                await this.delay(attempt);
            }
        }
        throw this.enhanceError(lastError);
    }

    private async performRequest(url: string, params?: any) {
        const response = await axios.get(url, {
            params,
            timeout: this.timeout,
        });

        if (response.data.status !== "success") {
            throw new Error(`Prometheus API error: ${response.data.error}`);
        }

        return response.data;
    }

    private shouldStopRetrying(error: any): boolean {
        if (!axios.isAxiosError(error)) {
            return true; // Don't retry on non-network errors (e.g. application errors)
        }
        if (error.response) {
            const status = error.response.status;
            // Don't retry on client errors (4xx) except 429 or 408
            return status >= 400 && status < 500 && status !== 429 && status !== 408;
        }
        return false;
    }

    private async delay(attempt: number) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    private enhanceError(error: any): Error {
        if (axios.isAxiosError(error)) {
            let message = error.message;
            if (error.code === 'ECONNREFUSED') {
                message = `Connection refused at ${this.baseUrl}. Is Prometheus running?`;
            } else if (error.code === 'ECONNABORTED') {
                message = `Request timed out after ${this.timeout}ms connecting to ${this.baseUrl}`;
            } else if (error.response) {
                message = `Request failed with status ${error.response.status}: ${error.response.statusText}`;
            }
            return new Error(`Network error: ${message}`);
        }
        // Handle AggregateError if it occurs
        if (error instanceof AggregateError) {
            return new Error(`Multiple errors occurred: ${error.errors.map((e: any) => e.message).join(', ')}`);
        }
        return error;
    }

    /**
     * Fetches alerts from the Prometheus API.
     * @returns The JSON response from Prometheus alerts endpoint.
     */
    public async getAlerts(): Promise<any> {
        const url = `${this.baseUrl}/api/v1/alerts`;
        return this.requestWithRetry(url);
    }

    /**
     * Fetches metrics from the Prometheus API.
     * @param query The PromQL query string.
     * @returns The JSON response from Prometheus.
     */
    public async query(query: string): Promise<any> {
        if (!query) {
            throw new Error("Query cannot be empty");
        }
        const url = `${this.baseUrl}/api/v1/query`;
        return this.requestWithRetry(url, { query });
    }

    /**
     * Fetches metrics over a range of time from the Prometheus API.
     * @param query The PromQL query string.
     * @param start Start timestamp in seconds.
     * @param end End timestamp in seconds.
     * @param step Query resolution step width in seconds.
     * @returns The JSON response from Prometheus.
     */
    public async queryRange(query: string, start: number, end: number, step: number): Promise<any> {
        if (!query) {
            throw new Error("Query cannot be empty");
        }
        const url = `${this.baseUrl}/api/v1/query_range`;
        return this.requestWithRetry(url, { query, start, end, step });
    }
}
