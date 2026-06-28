import { describe, it, expect, beforeEach, vi } from "vitest";
import { StorageService } from "./storage.ts";

let testCounter = 0;

describe("StorageService", () => {
  let storage: StorageService;
  let dbName: string;

  beforeEach(async () => {
    // Use a unique DB per test to avoid connection blocking between tests
    dbName = `emom-timer-test-${Date.now()}-${++testCounter}`;
    storage = new StorageService(dbName);
    await storage.init();
  });

  it("saves session and returns record with date", async () => {
    const session = {
      duration: 300,
      interval: 60,
      activityType: 115,
    };

    const record = await storage.saveSession(session);

    expect(record.duration).toBe(300);
    expect(record.activityType).toBe(115);
    expect(record.date).toBeInstanceOf(Date);
  });

  it("calculates streak correctly", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Mock Date
    vi.useFakeTimers({ toFake: ["Date"] });

    // Day 1 (Yesterday)
    vi.setSystemTime(yesterday);
    await storage.saveSession({ duration: 10, interval: 60, activityType: 115 });

    // Day 2 (Today)
    vi.setSystemTime(today);
    await storage.saveSession({ duration: 10, interval: 60, activityType: 115 });

    // Reset Date
    vi.useRealTimers();

    const streak = await storage.getStreak();
    expect(streak).toBe(2);
  });

  it("saves and loads settings", async () => {
    const settings = {
      intervalCount: 8,
      intervalSecs: 45,
      activityType: 114,
      includeLocation: true,
      setupComplete: true,
    };

    await storage.saveSettings(settings);
    const loaded = await storage.loadSettings();
    expect(loaded).toEqual(settings);
  });

  it("returns undefined for non-existent settings", async () => {
    const settings = await storage.loadSettings();
    expect(settings).toBeUndefined();
  });
});
