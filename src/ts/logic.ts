// Core logic functions (Universal: Browser + CJS)

import { TimerConfig } from "./types.ts";

interface TimerLogicState {
  elapsed: number;
  totalDuration?: number;
  intervalDuration?: number;
}

const SECONDS_PER_MINUTE = 60;
const FINISH_TOLERANCE = 0.05;
const DEFAULT_BEEP_FREQUENCY = 440;
const BEEP_HIGH = 554;
const BEEP_HIGHER = 659;
const DEFAULT_ACTIVITY_TYPE = 115;
const DEFAULT_MODE = "emom";
const DEFAULT_INTERVAL_COUNT = 5;

export function calculateDisplayTime(elapsed: number, interval: number): number {
  const currentIntervalElapsed = elapsed % interval;
  return Math.max(0, interval - currentIntervalElapsed);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / SECONDS_PER_MINUTE)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % SECONDS_PER_MINUTE)
    .toString()
    .padStart(2, "0");
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
  return (elapsed % intervalDuration) / intervalDuration;
}

interface RoundInfo {
  current: number;
  total: number;
}

export function getCurrentRound(state: Required<TimerLogicState>): RoundInfo {
  const { elapsed, intervalDuration, totalDuration } = state;
  if (intervalDuration <= 0) return { current: 0, total: 0 };
  const totalRounds = Math.floor(totalDuration / intervalDuration);
  const currentRound = Math.min(
    Math.floor(elapsed / intervalDuration) + 1,
    totalRounds,
  );
  return { current: currentRound, total: totalRounds };
}

export function isFinished(elapsed: number, totalDuration: number): boolean {
  return elapsed >= totalDuration - FINISH_TOLERANCE;
}

export type BeepCheck =
  | { shouldBeep: false }
  | { shouldBeep: true; frequency: number; type: "countdown" | "complete"; newBeepId: string };

interface BeepContext {
  elapsed: number;
  intervalDuration: number;
  lastBeepId?: string | number;
}

export function getBeepFrequency(secondsRemainingInt: number): number {
  if (secondsRemainingInt === 2) return BEEP_HIGH;
  if (secondsRemainingInt === 1) return BEEP_HIGHER;
  return DEFAULT_BEEP_FREQUENCY;
}

export function getCountdownBeep(context: BeepContext): BeepCheck {
  const { elapsed, intervalDuration, lastBeepId } = context;
  const currentIntervalRemaining = intervalDuration - (elapsed % intervalDuration);
  const secondsRemainingInt = Math.ceil(currentIntervalRemaining);

  if (secondsRemainingInt > 0 && secondsRemainingInt <= 3) {
    const currentRound = Math.floor(elapsed / intervalDuration);
    const beepId = `${currentRound}-${secondsRemainingInt}`;

    if (lastBeepId !== beepId) {
      return {
        shouldBeep: true,
        frequency: getBeepFrequency(secondsRemainingInt),
        type: "countdown",
        newBeepId: beepId,
      };
    }
  }

  return { shouldBeep: false };
}

export function normalizeDate(date: Date): number {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.getTime();
}

function countConsecutiveDays(startDate: Date, uniqueDates: Set<number>): number {
  let streak = 0;
  const check = new Date(startDate);

  while (uniqueDates.has(normalizeDate(check))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }

  return streak;
}

export function calculateStreak(dates: Date[]): number {
  if (!dates?.length) return 0;

  const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
  const uniqueDates = new Set(sortedDates.map(normalizeDate));

  const today = new Date();
  const todayTime = normalizeDate(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayTime = normalizeDate(yesterday);

  if (!uniqueDates.has(todayTime) && !uniqueDates.has(yesterdayTime)) {
    return 0;
  }

  const startDate = uniqueDates.has(todayTime) ? today : yesterday;
  return countConsecutiveDays(startDate, uniqueDates);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickMode(raw: unknown, fallback: TimerConfig["mode"]): TimerConfig["mode"] {
  return raw === "fartlek" || raw === "emom" ? raw : fallback || DEFAULT_MODE;
}

function pickNumber(raw: unknown, fallback: number, min?: number): number {
  if (typeof raw !== "number") return fallback;
  if (min !== undefined && raw <= min) return fallback;
  return raw;
}

function pickBool(raw: unknown): boolean {
  return Boolean(raw);
}

function calculateIntervalCountFromDuration(
  totalDurationSecs: number,
  intervalSecs: number,
): number {
  return Math.floor(totalDurationSecs / intervalSecs) || DEFAULT_INTERVAL_COUNT;
}

function determineIntervalCount(settings: Record<string, unknown>, defaults: TimerConfig): number {
  const intervalCount = settings.intervalCount;
  if (typeof intervalCount === "number" && intervalCount > 0) {
    return intervalCount;
  }

  const totalDurationSecs = settings.totalDurationSecs;
  if (typeof totalDurationSecs === "number") {
    const intervalSecs = pickNumber(settings.intervalSecs, defaults.intervalSecs);
    return calculateIntervalCountFromDuration(totalDurationSecs, intervalSecs);
  }

  return defaults.intervalCount;
}

export function normalizeConfig(
  settings: unknown,
  defaults: TimerConfig,
): Omit<TimerConfig, "totalDurationSecs"> {
  if (!settings || !isPlainObject(settings)) {
    return {
      mode: defaults.mode || DEFAULT_MODE,
      intervalCount: defaults.intervalCount,
      intervalSecs: defaults.intervalSecs,
      activityType: defaults.activityType,
      includeLocation: defaults.includeLocation,
    };
  }

  const intervalSecs = pickNumber(settings.intervalSecs, defaults.intervalSecs);

  return {
    mode: pickMode(settings.mode, defaults.mode),
    intervalCount: determineIntervalCount(settings, defaults),
    intervalSecs,
    activityType: pickNumber(settings.activityType, DEFAULT_ACTIVITY_TYPE, 0),
    includeLocation: pickBool(settings.includeLocation),
  };
}
