import { describe, it, expect } from 'vitest';
import { formatTime, calculateTotalProgress, calculateIntervalProgress, getCurrentRound, getCountdownBeep, isFinished } from './logic.js';

describe('formatTime', () => {
    it('formats seconds into MM:SS', () => {
        expect(formatTime(0)).toBe('00:00');
        expect(formatTime(60)).toBe('01:00');
        expect(formatTime(65)).toBe('01:05');
        expect(formatTime(600)).toBe('10:00');
        expect(formatTime(3599)).toBe('59:59');
    });
});

describe('Progress Calculations', () => {
    it('calculates total progress', () => {
        expect(calculateTotalProgress(0, 100)).toBe(0);
        expect(calculateTotalProgress(50, 100)).toBe(0.5);
        expect(calculateTotalProgress(100, 100)).toBe(1);
        expect(calculateTotalProgress(101, 100)).toBe(1); // Cap at 1
    });

    it('calculates interval progress', () => {
        // elapsed, interval
        expect(calculateIntervalProgress(0, 60)).toBe(0);
        expect(calculateIntervalProgress(30, 60)).toBe(0.5);
        expect(calculateIntervalProgress(60, 60)).toBe(0); // Wrap around
        expect(calculateIntervalProgress(90, 60)).toBe(0.5);
    });
});

describe('Round Calculations', () => {
    it('calculates current round correctly', () => {
        // elapsed, interval, totalDuration
        expect(getCurrentRound(0, 60, 600)).toEqual({ current: 1, total: 10 });
        expect(getCurrentRound(59, 60, 600)).toEqual({ current: 1, total: 10 });
        expect(getCurrentRound(60, 60, 600)).toEqual({ current: 2, total: 10 });
        expect(getCurrentRound(599, 60, 600)).toEqual({ current: 10, total: 10 });
    });
});

describe('Countdown Logic', () => {
    it('should trigger beep at 3s remaining', () => {
        // elapsed=57, interval=60 -> 3s remaining
        const res = getCountdownBeep(57, 60, 'last-id');
        expect(res.shouldBeep).toBe(true);
        expect(res.freq).toBe(440);
    });

    it('should trigger beep at 2s remaining', () => {
        // elapsed=58, interval=60 -> 2s remaining
        const res = getCountdownBeep(58, 60, 'last-id');
        expect(res.shouldBeep).toBe(true);
        expect(res.freq).toBe(554);
    });

    it('should trigger beep at 1s remaining', () => {
        // elapsed=59, interval=60 -> 1s remaining
        const res = getCountdownBeep(59, 60, 'last-id');
        expect(res.shouldBeep).toBe(true);
        expect(res.freq).toBe(659);
    });

    it('should NOT beep if already beeped this second', () => {
        // elapsed=57 (3s rem), but lastBeepId matches current round/sec
        // round 0, 3s rem -> "0-3"
        const res = getCountdownBeep(57, 60, '0-3');
        expect(res.shouldBeep).toBe(false);
    });

    it('should NOT beep at 4s remaining', () => {
        const res = getCountdownBeep(56, 60, 'last-id');
        expect(res.shouldBeep).toBe(false);
    });
});

describe('isFinished', () => {
    it('returns true when elapsed >= total (minus tolerance)', () => {
        expect(isFinished(600, 600)).toBe(true);
        expect(isFinished(599.95, 600)).toBe(true);
        expect(isFinished(500, 600)).toBe(false);
    });
});
