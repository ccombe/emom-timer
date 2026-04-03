import { describe, it, expect, vi, beforeEach } from "vitest";
import { TimerEngine, TimerCallbacks } from "./timer-engine.ts";
import { TimerConfig } from "./types.ts";

describe("TimerEngine - Variable Interval (Fartlek)", () => {
  let callbacks: TimerCallbacks;

  beforeEach(() => {
    callbacks = {
      onTick: vi.fn(),
      onIntervalStart: vi.fn(),
      onCountdownBeep: vi.fn(),
      onComplete: vi.fn(),
    };
  });

  it("calculates current phase dynamically based on total elapsed", () => {
    const config: TimerConfig = {
      mode: "fartlek",
      intervalCount: 1, // Ignored
      intervalSecs: 60, // Ignored
      activityType: 115,
      includeLocation: false,
      phases: [
        { name: "Walk", durationSecs: 60 },
        { name: "Jog", durationSecs: 120 },
        { name: "Run", durationSecs: 30 },
      ],
      // We fake the getter for tests
      totalDurationSecs: 210,
    };

    const engine = new TimerEngine(config, callbacks);

    // Internal tick testing
    engine.state.startTime = Date.now();
    engine.state.isRunning = true;
  });

  it("accurately returns phase info depending on elapsed time", () => {
    const config: TimerConfig = {
      mode: "fartlek",
      intervalCount: 1,
      intervalSecs: 60,
      activityType: 115,
      includeLocation: false,
      phases: [
        { name: "Walk", durationSecs: 60 },
        { name: "Jog", durationSecs: 120 },
        { name: "Run", durationSecs: 30 },
      ],
      totalDurationSecs: 210,
    };

    const engine = new TimerEngine(config, callbacks);

    // Mock elapsed time
    engine.state.currentTotalElapsed = 30; // Middle of Walk
    // @ts-ignore
    let phase = engine.getCurrentPhaseInfo();
    expect(phase.index).toBe(0);
    expect(phase.name).toBe("Walk");
    expect(phase.elapsedInPhase).toBe(30);

    engine.state.currentTotalElapsed = 60; // Exactly start of Jog
    // @ts-ignore
    phase = engine.getCurrentPhaseInfo();
    expect(phase.index).toBe(1);
    expect(phase.name).toBe("Jog");
    expect(phase.elapsedInPhase).toBe(0);

    engine.state.currentTotalElapsed = 179; // End of Jog
    // @ts-ignore
    phase = engine.getCurrentPhaseInfo();
    expect(phase.index).toBe(1);
    expect(phase.name).toBe("Jog");
    expect(phase.elapsedInPhase).toBe(119);

    engine.state.currentTotalElapsed = 180; // Start of Run
    // @ts-ignore
    phase = engine.getCurrentPhaseInfo();
    expect(phase.index).toBe(2);
    expect(phase.name).toBe("Run");
    expect(phase.elapsedInPhase).toBe(0);

    engine.state.currentTotalElapsed = 250; // Over total duration
    // @ts-ignore
    phase = engine.getCurrentPhaseInfo();
    expect(phase.index).toBe(2); // Caps out at bounds
    expect(phase.name).toBe("Run");
    expect(phase.elapsedInPhase).toBe(250 - 180);
  });
});
