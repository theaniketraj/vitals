import axios from "axios";

export class AlertmanagerApi {
    private readonly baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }

    public async getAlerts(): Promise<any> {
        const url = `${this.baseUrl}/api/v2/alerts`;
        const response = await axios.get(url);
        return response.data;
    }

    public async getSilences(): Promise<any> {
        const url = `${this.baseUrl}/api/v2/silences`;
        const response = await axios.get(url);
        return response.data;
    }

    public async createSilence(silence: any): Promise<any> {
        const url = `${this.baseUrl}/api/v2/silences`;
        const response = await axios.post(url, silence);
        return response.data;
    }
}
