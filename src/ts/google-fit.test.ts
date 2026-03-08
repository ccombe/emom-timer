import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleFitService } from './google-fit.ts';

// Mock Fetch
globalThis.fetch = vi.fn();

// Mock localStorage
const localStorageMock = (function () {
    let store: Record<string, string> = {};
    return {
        getItem: function (key: string) {
            return store[key] || null;
        },
        setItem: function (key: string, value: string) {
            store[key] = value.toString();
        },
        removeItem: function (key: string) {
            delete store[key];
        },
        clear: function () {
            store = {};
        }
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('GoogleFitService', () => {
    let service: GoogleFitService;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        // Mock Date.now() for consistent testing
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
        service = new GoogleFitService();
        service.accessToken = 'mock-token'; // Simulate connected
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('constructor and token expiry', () => {
        it('clears expired token on initialization', () => {
            localStorage.setItem('google_fit_token', 'old-token');
            localStorage.setItem('google_fit_token_expiry', (Date.now() - 1000).toString());

            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const newService = new GoogleFitService();
            expect(newService.accessToken).toBeNull();
            expect(localStorage.getItem('google_fit_token')).toBeNull();
            logSpy.mockRestore();
        });

        it('retains valid token on initialization', () => {
            const future = Date.now() + 3600000;
            localStorage.setItem('google_fit_token', 'valid-token');
            localStorage.setItem('google_fit_token_expiry', future.toString());

            const newService = new GoogleFitService();
            expect(newService.accessToken).toBe('valid-token');
        });
    });

    describe('initialize', () => {
        it('does nothing if globalThis.google is missing', () => {
            const hadGoogle = 'google' in globalThis;
            const originalGoogle = (globalThis as any).google;
            try {
                delete (globalThis as any).google;
                service.initialize();
                expect(service.tokenClient).toBeNull();
            } finally {
                if (hadGoogle) {
                    (globalThis as any).google = originalGoogle;
                } else {
                    delete (globalThis as any).google;
                }
            }
        });

        it('initializes token client when globalThis.google exists', () => {
            const hadGoogle = 'google' in globalThis;
            const originalGoogle = (globalThis as any).google;
            const mockInitTokenClient = vi.fn().mockReturnValue({ requestAccessToken: vi.fn() });

            try {
                (globalThis as any).google = {
                    accounts: {
                        oauth2: {
                            initTokenClient: mockInitTokenClient
                        }
                    }
                };

                service.initialize();
                expect(mockInitTokenClient).toHaveBeenCalled();
                expect(service.tokenClient).toBeDefined();
            } finally {
                if (hadGoogle) {
                    (globalThis as any).google = originalGoogle;
                } else {
                    delete (globalThis as any).google;
                }
            }
        });
    });

    describe('connect', () => {
        it('calls requestAccessToken if client exists', () => {
            const requestMock = vi.fn();
            service.tokenClient = { requestAccessToken: requestMock };
            service.connect();
            expect(requestMock).toHaveBeenCalled();
        });

        it('logs error if client does not exist', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
            service.tokenClient = null;
            service.connect();
            expect(spy).toHaveBeenCalledWith("Google Identity Services not initialized.");
            spy.mockRestore();
        });
    });

    describe('uploadSession', () => {
        it('uploads valid session data', async () => {
            const session = {
                duration: 300,
                interval: 60,
                activityType: 115,
                location: { lat: 10, lng: 20 }
            };

            // Mock successful upload
            (fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            });
            // Mock location upload (if applicable, the code calls it separately but we mocked fetch globally)
            (fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            });

            const result = await service.uploadSession(session);

            expect(result).toBe(true);

            // Allow time for async calls
            await new Promise(process.nextTick);

            // Check first fetch call (Session Upload)
            const [url, options] = (fetch as any).mock.calls[0];
            expect(url).toContain('https://www.googleapis.com/fitness/v1/users/me/sessions/');
            expect(options.method).toBe('PUT');

            const body = JSON.parse(options.body);
            expect(body.activityType).toBe(115);
            expect(body.name).toBe("EMOM Workout");

            // Verify start/end time calculation
            // End = Now (roughly), Start = Now - 300s
            expect(body.endTimeMillis).toBeGreaterThan(body.startTimeMillis);
            expect(body.endTimeMillis - body.startTimeMillis).toBe(300000); // 300 * 1000
        });

        it('handles upload errors gracefully', async () => {
            (fetch as any).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: "Bad request" })
            });

            // Mock console.error to avoid noisy stderr in tests
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await service.uploadSession({ duration: 60, interval: 60, activityType: 114 });
            expect(result).toBe(false);

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('fetchWorkoutHistory', () => {
        it('parses bucket response correctly', async () => {
            const mockResponse = {
                bucket: [
                    {
                        startTimeMillis: "1678886400000",
                        dataset: [{
                            point: [{
                                value: [{ intVal: 114 }] // HIIT Activity
                            }]
                        }]
                    }
                ]
            };

            (fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const dates = await service.fetchWorkoutHistory();
            expect(dates).toHaveLength(1);
            expect(dates[0]).toBe(1678886400000);
        });

        it('returns empty array on error', async () => {
            (fetch as any).mockResolvedValueOnce({ ok: false });
            const dates = await service.fetchWorkoutHistory();
            expect(dates).toEqual([]);
        });

        it('handles fetch exceptions gracefully', async () => {
            (fetch as any).mockRejectedValueOnce(new Error('Network failure'));
            const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const dates = await service.fetchWorkoutHistory();
            expect(dates).toEqual([]);
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('handles malformed/empty buckets gracefully', async () => {
            const mockResponse = {
                bucket: [
                    { startTimeMillis: "100", dataset: [] }, // Empty dataset
                    { startTimeMillis: "200", dataset: [{ point: [] }] }, // Empty points
                    { startTimeMillis: "300" } // No dataset
                ]
            };

            (fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const dates = await service.fetchWorkoutHistory();
            expect(dates).toEqual([]);
        });
    });
});
