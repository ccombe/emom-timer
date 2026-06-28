import {
  WorkoutSession,
  GoogleTokenResponse,
  GoogleFitAggregateResponse,
  GoogleFitBucket,
} from "./types.ts";

const SCOPES =
  "https://www.googleapis.com/auth/fitness.activity.write https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.location.write";

const VALID_ACTIVITY_TYPES = new Set([10, 15, 21, 97, 113, 114, 115]);

// Extend Window interface for Google Identity Services
declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export class GoogleFitService {
  tokenClient: { requestAccessToken: () => void } | null = null;
  accessToken: string | null;
  tokenExpiry: number;

  constructor() {
    this.accessToken = this.loadTokenFromStorage();
    this.tokenExpiry = this.loadExpiryFromStorage();

    if (this.accessToken && Date.now() > this.tokenExpiry) {
      this.clearToken();
    }
  }

  private loadTokenFromStorage(): string | null {
    return localStorage.getItem("google_fit_token");
  }

  private loadExpiryFromStorage(): number {
    return Number.parseInt(localStorage.getItem("google_fit_token_expiry") || "0");
  }

  private persistToken(token: string, expiry: number): void {
    localStorage.setItem("google_fit_token", token);
    localStorage.setItem("google_fit_token_expiry", expiry.toString());
  }

  private clearToken(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
    localStorage.removeItem("google_fit_token");
    localStorage.removeItem("google_fit_token_expiry");
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  private apiFetch(url: string, method: string, body?: object): Promise<Response> {
    return fetch(url, {
      method,
      headers: this.getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private dispatchEvent(name: string): void {
    document.dispatchEvent(new CustomEvent(name));
  }

  initialize(): void {
    const gis =
      globalThis.window === undefined ? undefined : globalThis.window.google;
    if (gis) {
      this.tokenClient = gis.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: GoogleTokenResponse) => {
          if (tokenResponse?.access_token) {
            this.accessToken = tokenResponse.access_token;
            this.tokenExpiry = Date.now() + tokenResponse.expires_in * 1000;

            this.persistToken(this.accessToken, this.tokenExpiry);
            this.dispatchEvent("google-fit-connected");
          }
        },
      });
    }
  }

  connect(): void {
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken();
    }
  }

  isConnected(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiry;
  }

  private buildSessionPayload(session: WorkoutSession, endTimeMillis: number) {
    const startTimeMillis = endTimeMillis - session.duration * 1000;
    return {
      id: `emom-timer-${startTimeMillis}`,
      name: "EMOM Workout",
      description: "EMOM Timer Session",
      startTimeMillis,
      endTimeMillis,
      modifiedTimeMillis: endTimeMillis,
      application: {
        detailsUrl: "https://ccombe.github.io/emom-timer/",
        name: "EMOM Timer",
        version: "1.0",
      },
      activityType: session.activityType || 114,
    };
  }

  private async uploadSessionMetadata(sessionData: object, sessionId: string): Promise<void> {
    const response = await this.apiFetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions/${sessionId}`,
      "PUT",
      sessionData,
    );

    if (!response.ok) {
      throw new Error("Failed to upload session");
    }
  }

  async uploadSession(session: WorkoutSession): Promise<boolean> {
    if (!this.accessToken) {
      return false;
    }

    const endTimeMillis = Date.now();
    const sessionData = this.buildSessionPayload(session, endTimeMillis);

    try {
      this.dispatchEvent("google-fit-sync-start");
      await this.uploadSessionMetadata(sessionData, sessionData.id);

      if (session.location) {
        await this.uploadLocationSample(
          sessionData.startTimeMillis,
          endTimeMillis,
          session.location.lat,
          session.location.lng,
        );
      }

      this.dispatchEvent("google-fit-sync-success");
      return true;
    } catch {
      this.dispatchEvent("google-fit-sync-error");
      return false;
    }
  }

  async uploadLocationSample(
    startTimeMillis: number,
    endTimeMillis: number,
    lat: number,
    lng: number,
  ): Promise<void> {
    const dataSourceId = "raw:com.google.location.sample:com.ccombe.emomtimer:LocationSource";
    const datasetId = `${startTimeMillis * 1000000}-${endTimeMillis * 1000000}`;
    const url = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${dataSourceId}/datasets/${datasetId}`;

    const body = {
      dataSourceId: dataSourceId,
      minStartTimeNs: startTimeMillis * 1000000,
      maxEndTimeNs: endTimeMillis * 1000000,
      point: [
        {
          startTimeNanos: startTimeMillis * 1000000,
          endTimeNanos: endTimeMillis * 1000000,
          dataTypeName: "com.google.location.sample",
          value: [
            { fpVal: lat, mapVal: [] },
            { fpVal: lng, mapVal: [] },
            { fpVal: 10, mapVal: [] },
            { fpVal: 0, mapVal: [] },
          ],
        },
      ],
    };

    try {
      await this.apiFetch(url, "PATCH", body);
    } catch {
      // Location is optional; silently fail
    }
  }

  private createAggregateRequestBody(startTime: number, endTime: number) {
    return {
      aggregateBy: [
        {
          dataTypeName: "com.google.activity.segment",
        },
      ],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    };
  }

  private containsWorkout(points: { value: { intVal: number }[] }[]): boolean {
    return points.some((p) => {
      const intVal = p.value?.[0]?.intVal;
      return intVal !== undefined && VALID_ACTIVITY_TYPES.has(intVal);
    });
  }

  private hasValidDataPoints(bucket: GoogleFitBucket): boolean {
    return (bucket.dataset?.[0]?.point?.length ?? 0) > 0;
  }

  private processBuckets(buckets: GoogleFitBucket[]): number[] {
    const activeDates: number[] = [];
    for (const bucket of buckets) {
      if (this.hasValidDataPoints(bucket) && this.containsWorkout(bucket.dataset[0].point)) {
        activeDates.push(Number.parseInt(bucket.startTimeMillis));
      }
    }
    return activeDates;
  }

  private async fetchAggregateData(startTime: number, endTime: number): Promise<GoogleFitAggregateResponse | null> {
    const response = await this.apiFetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
      "POST",
      this.createAggregateRequestBody(startTime, endTime),
    );

    if (!response.ok) return null;
    return response.json();
  }

  async fetchWorkoutHistory(days: number = 60): Promise<number[]> {
    if (!this.accessToken) return [];

    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    try {
      const data = await this.fetchAggregateData(startTime, endTime);
      if (!data?.bucket) return [];
      return this.processBuckets(data.bucket);
    } catch {
      return [];
    }
  }
}

export const googleFit = new GoogleFitService();
