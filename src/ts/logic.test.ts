import { describe, it, expect } from 'vitest';
import {
    formatTime,
    calculateDisplayTime,
    calculateTotalProgress,
    calculateIntervalProgress,
    getCurrentRound,
    isFinished,
    calculateStreak,
    getCountdownBeep,
    normalizeDate,
    normalizeConfig
} from './logic.ts';
import { TimerConfig } from './types.ts';

describe('Core Logic', () => {
    describe('calculateDisplayTime', () => {
        it('should return remaining time (countdown)', () => {
            expect(calculateDisplayTime(10, 60)).toBe(50);
            expect(calculateDisplayTime(59, 60)).toBe(1);
        });

        it('should return interval duration when interval rolls over', () => {
            expect(calculateDisplayTime(60, 60)).toBe(60);
        });
    });

    describe('formatTime', () => {
        it('formats seconds into mm:ss', () => {
            expect(formatTime(0)).toBe('00:00');
            expect(formatTime(9)).toBe('00:09');
            expect(formatTime(60)).toBe('01:00');
            expect(formatTime(65)).toBe('01:05');
            expect(formatTime(600)).toBe('10:00');
        });
    });

    describe('Progress Calculations', () => {
        it('calculates total progress correctly', () => {
            expect(calculateTotalProgress({ elapsed: 0, totalDuration: 100 })).toBe(0);
            expect(calculateTotalProgress({ elapsed: 50, totalDuration: 100 })).toBe(0.5);
            expect(calculateTotalProgress({ elapsed: 100, totalDuration: 100 })).toBe(1);
        });

        it('calculates interval progress correctly', () => {
            // interval = 60s
            expect(calculateIntervalProgress({ elapsed: 0, intervalDuration: 60 })).toBe(0);
            expect(calculateIntervalProgress({ elapsed: 30, intervalDuration: 60 })).toBe(0.5);
            expect(calculateIntervalProgress({ elapsed: 60, intervalDuration: 60 })).toBe(0);
            expect(calculateIntervalProgress({ elapsed: 90, intervalDuration: 60 })).toBe(0.5);
        });
    });

    describe('Round Calculation', () => {
        const intervalSecs = 60;
        const totalDuration = 300; // 5 rounds

        it('identifies rounds correctly', () => {
            // Start (0s) -> Round 1
            expect(getCurrentRound({ elapsed: 0, intervalDuration: intervalSecs, totalDuration })).toEqual({ current: 1, total: 5 });

            // 59s -> Round 1
            expect(getCurrentRound({ elapsed: 59, intervalDuration: intervalSecs, totalDuration })).toEqual({ current: 1, total: 5 });

            // 60s -> Round 2 (Start of 2nd minute)
            expect(getCurrentRound({ elapsed: 60, intervalDuration: intervalSecs, totalDuration })).toEqual({ current: 2, total: 5 });

            // 299s -> Round 5
            expect(getCurrentRound({ elapsed: 299, intervalDuration: intervalSecs, totalDuration })).toEqual({ current: 5, total: 5 });
        });

        it('handles finished state', () => {
            expect(getCurrentRound({ elapsed: 300, intervalDuration: intervalSecs, totalDuration })).toEqual({ current: 5, total: 5 });
        });
    });

    describe('isFinished', () => {
        it('returns true when elapsed >= duration', () => {
            expect(isFinished(300, 300)).toBe(true);
            expect(isFinished(301, 300)).toBe(true);
        });

        it('returns false when elapsed < duration', () => {
            expect(isFinished(299.9, 300)).toBe(false);
        });
    });

    describe('getCountdownBeep', () => {
        const intervalSecs = 60;

        it.each([
            { elapsed: 57, freq: 440, id: '0-3', desc: '3 seconds remaining' },
            { elapsed: 58, freq: 554, id: '0-2', desc: '2 seconds remaining' },
            { elapsed: 59, freq: 659, id: '0-1', desc: '1 second remaining' },
        ])('should beep at $desc ($elapsed seconds elapsed)', ({ elapsed, freq }) => {
            const context = { elapsed, intervalDuration: intervalSecs, lastBeepId: undefined };
            const result = getCountdownBeep(context);

            expect(result.shouldBeep).toBe(true);
            if (result.shouldBeep) {
                expect(result.frequency).toBe(freq); // corrected freq -> frequency property check
                // newBeepId might not be exposed directly in result type based on logic.ts, need to check if we can test it or just ignore
                // Looking at logic.ts update, it returns { shouldBeep: true, frequency: freq, type: 'countdown' }
                // It does NOT return newBeepId. So we should remove that expectation.
            }
        });

        it('should not beep if already beeped this second', () => {
            const context = { elapsed: 59, intervalDuration: intervalSecs, lastBeepId: '0-1' };
            const result = getCountdownBeep(context);
            expect(result.shouldBeep).toBe(false);
        });

        it('should not beep at 4 seconds remaining (56s elapsed)', () => {
            const context = { elapsed: 56, intervalDuration: intervalSecs, lastBeepId: undefined };
            const result = getCountdownBeep(context);
            expect(result.shouldBeep).toBe(false);
        });
    });

    describe('normalizeDate', () => {
        it('should return midnight timestamp', () => {
            const date = new Date('2023-10-10T12:34:56');
            const expected = new Date('2023-10-10T00:00:00').getTime();
            expect(normalizeDate(date)).toBe(expected);
        });
    });

    describe('calculateStreak', () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        it('returns 0 for empty history', () => {
            expect(calculateStreak([])).toBe(0);
        });

        it('returns 1 if attended today only', () => {
            expect(calculateStreak([today])).toBe(1);
        });

        it('returns 1 if attended yesterday only', () => {
            expect(calculateStreak([yesterday])).toBe(1);
        });

        it('returns 2 if attended today and yesterday', () => {
            expect(calculateStreak([today, yesterday])).toBe(2);
        });

        it('returns 0 if last attendance was 2 days ago', () => {
            expect(calculateStreak([twoDaysAgo])).toBe(0);
        });

        it('counts correctly with gaps', () => {
            // Today, Yesterday, (Gap), 3 Days Ago -> Streak 2
            expect(calculateStreak([today, yesterday, new Date('2000-01-01')])).toBe(2);
        });

        it('handles duplicate dates correctly', () => {
            expect(calculateStreak([today, today, yesterday])).toBe(2);
        });

        it('ignores future dates (optional behavior)', () => {
            expect(calculateStreak([tomorrow, today])).toBe(1);
        });
    });
});


describe('normalizeConfig', () => {
    const defaults: TimerConfig = {
        intervalCount: 5,
        intervalSecs: 60,
        activityType: 115,
        includeLocation: false,
        totalDurationSecs: 300
    };

    it('returns defaults if settings are null/undefined', () => {
        expect(normalizeConfig(null, defaults)).toEqual({
            intervalCount: 5,
            intervalSecs: 60,
            activityType: 115,
            includeLocation: false
        });
        expect(normalizeConfig(undefined, defaults)).toEqual({
            intervalCount: 5,
            intervalSecs: 60,
            activityType: 115,
            includeLocation: false
        });
    });

    it('migrates legacy totalDurationSecs correctly', () => {
        const legacySettings = {
            totalDurationSecs: 600, // 10 mins
            intervalSecs: 60,
            activityType: 115,
            includeLocation: false
        };
        const result = normalizeConfig(legacySettings, defaults);
        expect(result.intervalCount).toBe(10); // 600 / 60
    });

    it('uses default count if legacy migration fails (0 duration)', () => {
        const legacySettings = {
            totalDurationSecs: 0,
            intervalSecs: 60
        };
        const result = normalizeConfig(legacySettings, defaults);
        expect(result.intervalCount).toBe(5); // Fallback to default
    });

    it('prioritizes explicit intervalCount over legacy duration', () => {
        const settings = {
            intervalCount: 8,
            totalDurationSecs: 600, // Would be 10 if used
            intervalSecs: 60
        };
        const result = normalizeConfig(settings, defaults);
        expect(result.intervalCount).toBe(8);
    });

    it('handles false/0 values correctly', () => {
        const settings = {
            includeLocation: false
        };
        const result = normalizeConfig(settings, defaults);
        expect(result.includeLocation).toBe(false);
    });
});

