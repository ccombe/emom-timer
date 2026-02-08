import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleFitService } from './google-fit.ts';

// Mock Fetch
global.fetch = vi.fn();

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
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('GoogleFitService', () => {
    let service: GoogleFitService;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        service = new GoogleFitService();
        service.accessToken = 'mock-token'; // Simulate connected
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

            const result = await service.uploadSession({ duration: 60, interval: 60, activityType: 114 });
            expect(result).toBe(false);
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
