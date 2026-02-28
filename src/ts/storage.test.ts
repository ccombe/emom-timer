import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageService } from './storage.ts';

describe('StorageService', () => {
    let storage: StorageService;

    beforeEach(async () => {
        // Clear IndexedDB to ensure test isolation
        const DB_NAME = 'emom-timer-db';
        const request = indexedDB.deleteDatabase(DB_NAME);
        await new Promise((resolve, reject) => {
            request.onsuccess = resolve;
            request.onerror = reject;
            request.onblocked = () => {
                // If blocked, we might have a leak, but for tests we try to proceed
                resolve(null);
            };
        });
        storage = new StorageService();
    });

    afterEach(async () => {
        if (storage) {
            await storage.close();
        }
    });

    it('saves and retrieves session', async () => {
        const session = {
            duration: 300,
            interval: 60,
            activityType: 115
        };

        await storage.saveSession(session);
        const history = await storage.getHistory();

        expect(history).toHaveLength(1);
        expect(history[0].duration).toBe(300);
        expect(history[0].activityType).toBe(115);
    });

    it('calculates streak correctly', async () => {
        // Clear DB or assume fresh due to impl? 
        // fake-indexeddb persists in global state usually, might need cleanup
        // For now, let's just add two days

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Helper to inject data directly would be nice, but public API is saveSession
        // We can't easily force date in saveSession without modifying service to accept it or mocking Date
        // But StorageService assigns `new Date()` internally.

        // Mock Date
        const originalDate = global.Date;

        // Day 1 (Yesterday)
        const mockYesterday = new originalDate(yesterday);
        global.Date = class extends originalDate {
            constructor() { super(); return mockYesterday; }
            static now() { return mockYesterday.getTime(); }
        } as any;

        await storage.saveSession({ duration: 10, interval: 60, activityType: 115 });

        // Day 2 (Today)
        const mockToday = new originalDate(today);
        global.Date = class extends originalDate {
            constructor() { super(); return mockToday; }
            static now() { return mockToday.getTime(); }
        } as any;

        await storage.saveSession({ duration: 10, interval: 60, activityType: 115 });

        // Reset Date
        global.Date = originalDate;

        const streak = await storage.getStreak();
        expect(streak).toBe(2);
    });

    it('saves and loads settings', async () => {
        const settings = {
            intervalCount: 8,
            intervalSecs: 45,
            activityType: 114,
            includeLocation: true,
            setupComplete: true
        };

        await storage.saveSettings(settings);
        const loaded = await storage.loadSettings();
        expect(loaded).toEqual(settings);
    });

    it('returns undefined for non-existent settings', async () => {
        const settings = await storage.loadSettings();
        expect(settings).toBeUndefined();
    });
});
