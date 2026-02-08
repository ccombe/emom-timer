export interface TimerConfig {
    intervalCount: number;
    intervalSecs: number;
    activityType: number;
    includeLocation: boolean;
    readonly totalDurationSecs: number;
}

export interface TimerState {
    isRunning: boolean;
    startTime: number;
    elapsedPaused: number;
    lastFrameTime: number;
    currentTotalElapsed: number;
    lastBeepSecond: string | number;
    location: LocationData | null;
}

export interface WorkoutSession {
    duration: number;
    interval: number;
    activityType: number;
    location?: LocationData | null;
    date?: Date;
}

export interface SavedSettings {
    intervalCount: number;
    intervalSecs: number;
    activityType: number;
    includeLocation: boolean;
    setupComplete: boolean;
}

export interface GoogleFitBucket {
    startTimeMillis: string;
    endTimeMillis: string;
    dataset: {
        point: {
            value: [{ intVal: number }];
        }[];
    }[];
}

export interface GoogleFitAggregateResponse {
    bucket: GoogleFitBucket[];
}

export interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
    error?: string;
}

export interface LocationData {
    lat: number;
    lng: number;
}

