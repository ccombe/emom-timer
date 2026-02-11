// Core logic functions (Universal: Browser + CJS)

import { TimerConfig } from "./types.ts";

export interface TimerLogicState {
    elapsed: number;
    totalDuration?: number;
    intervalDuration?: number;
}

export function calculateDisplayTime(elapsed: number, interval: number): number {
    const currentIntervalElapsed = elapsed % interval;
    // Always countdown
    return Math.max(0, interval - currentIntervalElapsed);
}

export function formatTime(seconds: number): string {
    const m: string = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s: string = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export function calculateTotalProgress(state: TimerLogicState): number {
    const { elapsed, totalDuration } = state;
    if (!totalDuration || totalDuration <= 0) return 1;
    return Math.min(elapsed / totalDuration, 1);
}

export function calculateIntervalProgress(state: TimerLogicState): number {
    const { elapsed, intervalDuration } = state;
    if (!intervalDuration || intervalDuration <= 0) return 0;
    const currentIntervalSec: number = elapsed % intervalDuration;
    return currentIntervalSec / intervalDuration;
}

export interface RoundInfo {
    current: number;
    total: number;
}

export function getCurrentRound(state: Required<TimerLogicState>): RoundInfo {
    const { elapsed, intervalDuration, totalDuration } = state;
    if (intervalDuration <= 0) return { current: 0, total: 0 };
    const totalRounds: number = Math.floor(totalDuration / intervalDuration);
    let currentRound: number = Math.floor(elapsed / intervalDuration) + 1;
    if (currentRound > totalRounds) currentRound = totalRounds;
    return { current: currentRound, total: totalRounds };
}

// Use a small tolerance for float comparison
export function isFinished(elapsed: number, totalDuration: number): boolean {
    return elapsed >= totalDuration - 0.05;
}

export type BeepCheck =
    | { shouldBeep: false }
    | { shouldBeep: true; frequency: number; type: 'countdown' | 'complete'; newBeepId: string };

export interface BeepContext {
    elapsed: number;
    intervalDuration: number;
    lastBeepId?: string | number;
}

export function getBeepFrequency(secondsRemainingInt: number): number {
    if (secondsRemainingInt === 2) return 554;
    if (secondsRemainingInt === 1) return 659;
    return 440;
}

export function getCountdownBeep(context: BeepContext): BeepCheck {
    const { elapsed, intervalDuration, lastBeepId } = context;
    const currentIntervalElapsed: number = elapsed % intervalDuration;
    const currentIntervalRemaining: number = intervalDuration - currentIntervalElapsed;
    const secondsRemainingInt: number = Math.ceil(currentIntervalRemaining);

    // Logic: Beep at 3, 2, 1
    if (secondsRemainingInt <= 3 && secondsRemainingInt > 0) {
        // Prevent beep on very first start (elapsed 0) if necessary, 
        // but typically 0 elapsed means Duration remaining, so we are safe.
        // Needs a unique ID to prevent double triggers per second
        const currentRound: number = Math.floor(elapsed / intervalDuration);
        const beepId = `${currentRound}-${secondsRemainingInt}`;

        if (lastBeepId !== beepId) {
            const freq = getBeepFrequency(secondsRemainingInt);
            return { shouldBeep: true, frequency: freq, type: 'countdown', newBeepId: beepId };
        }
    }

    return { shouldBeep: false };
}

export function normalizeDate(date: Date): number {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized.getTime();
}

export function calculateStreak(dates: Date[]): number {
    if (!dates || dates.length === 0) return 0;

    // Sort by date descending
    const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());

    const today = new Date();
    const todayTime = normalizeDate(today);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayTime = normalizeDate(yesterday);

    // Normalize dates to midnight timestamps
    const uniqueDates = new Set(sortedDates.map(normalizeDate));

    if (!uniqueDates.has(todayTime) && !uniqueDates.has(yesterdayTime)) {
        return 0;
    }

    let streak = 0;
    let currentCheck = uniqueDates.has(todayTime) ? today : yesterday;

    while (uniqueDates.has(normalizeDate(currentCheck))) {
        streak++;
        currentCheck.setDate(currentCheck.getDate() - 1);
    }

    return streak;
}

export function determineIntervalCount(settings: any, defaults: TimerConfig): number {
    if (settings.intervalCount) {
        return settings.intervalCount;
    }
    if ('totalDurationSecs' in settings) {
        const legacy = settings as { totalDurationSecs: number };
        const intervalSecs = settings.intervalSecs || defaults.intervalSecs;
        return Math.floor(legacy.totalDurationSecs / intervalSecs) || 5;
    }
    return defaults.intervalCount;
}

export function normalizeConfig(settings: any, defaults: TimerConfig): Omit<TimerConfig, 'totalDurationSecs'> {
    if (!settings) {
        return {
            intervalCount: defaults.intervalCount,
            intervalSecs: defaults.intervalSecs,
            activityType: defaults.activityType,
            includeLocation: defaults.includeLocation
        };
    }

    return {
        intervalCount: determineIntervalCount(settings, defaults),
        intervalSecs: settings.intervalSecs || defaults.intervalSecs,
        activityType: settings.activityType || 115, // Default to Kettlebell if missing/zero
        includeLocation: !!settings.includeLocation
    };
}
