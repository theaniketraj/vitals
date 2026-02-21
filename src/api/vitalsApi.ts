import axios, { AxiosInstance } from "axios";

export interface VitalsUser {
  githubId: string;
  username: string;
  email?: string;
  lastLogin?: string;
  createdAt?: string;
}

export interface TelemetryEvent {
  githubId: string;
  eventName: string;
  properties?: Record<string, any>;
}

export class VitalsApiClient {
  private client: AxiosInstance;
  private static readonly API_BASE_URL =
    "https://g0l5lmjg3f.execute-api.us-east-1.amazonaws.com/dev";

  constructor() {
    this.client = axios.create({
      baseURL: VitalsApiClient.API_BASE_URL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Create or update user profile
   */
  async createUser(
    githubId: string,
    username: string,
    email?: string
  ): Promise<VitalsUser> {
    try {
      const response = await this.client.post("/users", {
        githubId,
        username,
        email,
      });
      return response.data.user;
    } catch (error) {
      console.error("Failed to create user:", error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getUser(githubId: string): Promise<VitalsUser | null> {
    try {
      const response = await this.client.get(`/users/${githubId}`);
      return response.data.user || response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error("Failed to get user:", error);
      throw error;
    }
  }

  /**
   * Log telemetry event
   */
  async logEvent(
    githubId: string,
    eventName: string,
    properties?: Record<string, any>
  ): Promise<void> {
    try {
      await this.client.post("/events", {
        githubId,
        eventName,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          extensionVersion: "0.3.1", // TODO: Get from package.json
        },
      });
    } catch (error) {
      // Don't throw errors for telemetry - fail silently
      console.error("Failed to log event:", error);
    }
  }

  /**
   * Get user's event history
   */
  async getUserEvents(githubId: string, limit: number = 50): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/events/${githubId}?limit=${limit}`
      );
      return response.data.events || [];
    } catch (error) {
      console.error("Failed to get user events:", error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/health");
      return response.data.status === "healthy";
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const vitalsApi = new VitalsApiClient();
