import { WorkoutSession, GoogleTokenResponse, GoogleFitAggregateResponse, GoogleFitBucket } from "./types.ts";

// Define strict constant scopes
const SCOPES = 'https://www.googleapis.com/auth/fitness.activity.write https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.location.write';

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
                }
            }
        };
    }
}

export class GoogleFitService {
    tokenClient: { requestAccessToken: () => void } | null;
    accessToken: string | null;
    tokenExpiry: number;

    constructor() {
        this.tokenClient = null;
        this.accessToken = localStorage.getItem('google_fit_token');
        this.tokenExpiry = parseInt(localStorage.getItem('google_fit_token_expiry') || '0');

        // Check if token is expired
        if (this.accessToken && Date.now() > this.tokenExpiry) {
            console.log("Token expired, clearing.");
            this.accessToken = null;
            this.tokenExpiry = 0;
            localStorage.removeItem('google_fit_token');
            localStorage.removeItem('google_fit_token_expiry');
        }
    }

    initialize(): void {
        if (!window.google) return; // GIS library not loaded

        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse: GoogleTokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    this.accessToken = tokenResponse.access_token;
                    // Token is usually valid for 3600s (1 hr)
                    this.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000); // expires_in is seconds

                    // Persist
                    localStorage.setItem('google_fit_token', this.accessToken!);
                    localStorage.setItem('google_fit_token_expiry', this.tokenExpiry.toString());

                    // Dispatch custom event
                    const event = new CustomEvent('google-fit-connected');
                    document.dispatchEvent(event);
                }
            },
        });
    }

    connect(): void {
        if (this.tokenClient) {
            // If we have a valid token, we might not need to prompt, but requestAccessToken 
            // will prompt if needed or skip if consent exists.
            // However, initTokenClient doesn't check validity on init.
            this.tokenClient.requestAccessToken();
        } else {
            console.error("Google Identity Services not initialized.");
        }
    }

    isConnected(): boolean {
        return !!this.accessToken && Date.now() < this.tokenExpiry;
    }

    async uploadSession(session: WorkoutSession): Promise<boolean> {
        if (!this.accessToken) {
            console.warn('No access token. Cannot upload to Google Fit.');
            return false;
        }

        // session: { duration: seconds, startTime: millis, activityType: int, location: {lat, lng} }
        const endTimeMillis = Date.now();
        const startTimeMillis = endTimeMillis - (session.duration * 1000);

        // Dataset IDs (nanoseconds)
        // const minStartTimeNs = startTimeMillis * 1000000;
        // const maxEndTimeNs = endTimeMillis * 1000000;

        const sessionData = {
            id: `emom-timer-${startTimeMillis}`,
            name: "EMOM Workout",
            description: "EMOM Timer Session",
            startTimeMillis: startTimeMillis,
            endTimeMillis: endTimeMillis,
            modifiedTimeMillis: endTimeMillis,
            application: {
                detailsUrl: "https://ccombe.github.io/emom-timer/",
                name: "EMOM Timer",
                version: "1.0"
            },
            activityType: session.activityType || 114,
        };

        try {
            // Dispatch sync start
            document.dispatchEvent(new CustomEvent('google-fit-sync-start'));

            // 1. Upload Session Metadata
            const response = await fetch(`https://www.googleapis.com/fitness/v1/users/me/sessions/${sessionData.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            if (!response.ok) {
                const err = await response.json();
                console.error('Google Fit Session Upload Error:', err);
                throw new Error('Failed to upload session');
            }

            // 2. Upload Location (if available)
            if (session.location) {
                await this.uploadLocationSample(startTimeMillis, endTimeMillis, session.location.lat, session.location.lng);
            }

            console.log('Workout uploaded to Google Fit!');
            // Dispatch sync success
            document.dispatchEvent(new CustomEvent('google-fit-sync-success'));
            return true;
        } catch (error) {
            console.error(error);
            // Dispatch sync error
            document.dispatchEvent(new CustomEvent('google-fit-sync-error'));
            return false;
        }
    }

    async uploadLocationSample(startTimeMillis: number, endTimeMillis: number, lat: number, lng: number): Promise<void> {
        // Create a derived data source for location if possible, or use raw
        // For simplicity, we create a specialized data source for this app
        const dataSourceId = "raw:com.google.location.sample:com.ccombe.emomtimer:LocationSource";

        // Format: raw:dataType:packageName:streamName

        // We'll try to PATCH the dataset directly. 
        // Dataset ID: startTime-endTime (nanoseconds)
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
                        { fpVal: lat, mapVal: [] }, // latitude
                        { fpVal: lng, mapVal: [] }, // longitude
                        { fpVal: 10, mapVal: [] },  // accuracy (meters) - mock value
                        { fpVal: 0, mapVal: [] }    // altitude (meters) - mock value
                    ]
                }
            ]
        };

        try {
            await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            console.log("Location stored.");
        } catch (e) {
            console.error("Failed to store location", e);
        }
    }

    private createAggregateRequestBody(startTime: number, endTime: number) {
        return {
            "aggregateBy": [{
                "dataTypeName": "com.google.activity.segment"
            }],
            "bucketByTime": { "durationMillis": 86400000 }, // 1 day
            "startTimeMillis": startTime,
            "endTimeMillis": endTime
        };
    }

    private containsWorkout(points: { value: { intVal: number }[] }[]): boolean {
        return points.some(p => {
            return p.value && p.value.length > 0 && p.value[0].intVal === 114; // HIIT
        });
    }

    private hasValidDataPoints(bucket: GoogleFitBucket): boolean {
        return !!(bucket.dataset && bucket.dataset.length > 0 && bucket.dataset[0].point.length > 0);
    }

    private processBuckets(buckets: GoogleFitBucket[]): number[] {
        const activeDates: number[] = [];
        buckets.forEach((bucket) => {
            if (this.hasValidDataPoints(bucket)) {
                const points = bucket.dataset[0].point;
                if (this.containsWorkout(points)) {
                    activeDates.push(parseInt(bucket.startTimeMillis));
                }
            }
        });
        return activeDates;
    }

    async fetchWorkoutHistory(days: number = 60): Promise<number[]> {
        if (!this.accessToken) return [];

        const endTime = Date.now();
        const startTime = endTime - (days * 24 * 60 * 60 * 1000);

        const body = this.createAggregateRequestBody(startTime, endTime);

        try {
            const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) return [];

            const data: GoogleFitAggregateResponse = await response.json();

            if (data.bucket) {
                return this.processBuckets(data.bucket);
            }
            return [];

        } catch (e) {
            console.error("Error fetching history", e);
            return [];
        }
    }
}

export const googleFit = new GoogleFitService();
