import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TimerEngine, TimerCallbacks } from "./timer-engine.ts";
import { TimerConfig } from "./types.ts";

describe("TimerEngine Core Coverage", () => {
  let callbacks: TimerCallbacks;
  
  // Fake config to inject
  const defaultConfig: TimerConfig = {
    mode: "emom",
    intervalCount: 5,
    intervalSecs: 60,
    activityType: 115,
    includeLocation: false,
    totalDurationSecs: 300,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Mock requestAnimationFrame for node environments
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => setTimeout(cb, 16)));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id) => clearTimeout(id)));

    callbacks = {
      onTick: vi.fn(),
      onIntervalStart: vi.fn(),
      onCountdownBeep: vi.fn(),
      onComplete: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("State Management", () => {
    it("should start and toggle correctly", () => {
      const engine = new TimerEngine(defaultConfig, callbacks);
      expect(engine.state.isRunning).toBe(false);

      // Start engine
      engine.start();
      expect(engine.state.isRunning).toBe(true);
      
      // Starting again should no-op
      engine.start();
      expect(engine.state.isRunning).toBe(true);

      // Toggle should pause
      engine.toggle();
      expect(engine.state.isRunning).toBe(false);
      
      // Toggle should start again
      engine.toggle();
      expect(engine.state.isRunning).toBe(true);
    });

    it("should reset completely", () => {
      const engine = new TimerEngine(defaultConfig, callbacks);
      engine.start();
      engine.state.currentTotalElapsed = 50;
      engine.state.location = { lat: 10, lng: 10 };
      
      engine.reset();
      expect(engine.state.isRunning).toBe(false);
      expect(engine.state.currentTotalElapsed).toBe(0);
      expect(engine.state.location).toBe(null);
      expect(callbacks.onTick).toHaveBeenCalled(); // Should trigger a final dom update
    });

    it("should toggle to start from beginning if finished", () => {
      const engine = new TimerEngine(defaultConfig, callbacks);
      engine.start();
      engine.state.currentTotalElapsed = 300; // Total duration reached
      engine.pause(); // Pause it naturally since checkCompletion would normally pause it natively
      
      engine.toggle(); // Because it's finished, this should reset AND start again natively
      
      expect(engine.state.isRunning).toBe(true);
      expect(engine.state.currentTotalElapsed).toBe(0);
    });

    it("sets location data", () => {
      const engine = new TimerEngine(defaultConfig, callbacks);
      engine.setLocation({ lat: 10, lng: 20 });
      expect(engine.state.location).toEqual({ lat: 10, lng: 20 });
    });
  });

  describe("Internal Tick loop & Callbacks", () => {
    it("should process basic ticks and fire onTick", () => {
      const engine = new TimerEngine(defaultConfig, callbacks);
      engine.start();
      
      expect(callbacks.onIntervalStart).toHaveBeenCalledWith(0); // Triggered natively on start when 0 elapsed
      
      // Advance time by 16ms (one frame roughly)
      vi.advanceTimersByTime(16);
      expect(callbacks.onTick).toHaveBeenCalled();
      expect(engine.state.currentTotalElapsed).toBeGreaterThan(0);
      
      // Stop should kill it
      engine.pause();
      expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
    });

    it("should trigger completion when time exceeds total duration", () => {
      const engine = new TimerEngine(defaultConfig, callbacks);
      engine.start();
      
      // Jump exactly to the end
      vi.advanceTimersByTime(300000); // 300 secs = 5 mins
      
      expect(callbacks.onComplete).toHaveBeenCalled();
      expect(engine.state.isRunning).toBe(false); // natively paused
    });

    it("handles countdown beeps for default EMOM configurations", () => {
      const engine = new TimerEngine(defaultConfig, callbacks);
      engine.start();
      
      // Artificially hard-mocking the date delta and running tick natively
      const originalNow = Date.now;
      Date.now = vi.fn(() => engine.state.startTime + 57100); // 57.1 seconds elapsed
      
      vi.advanceTimersByTime(16); // push one native frame
      
      expect(callbacks.onCountdownBeep).toHaveBeenCalled(); // Trigger beep on 3 boundary
      
      Date.now = originalNow;
    });
    
    it("reports correct EMOM index and names", () => {
       const engine = new TimerEngine(defaultConfig, callbacks);
       engine.start();
       
       const originalNow = Date.now;
       Date.now = vi.fn(() => engine.state.startTime + 65000); // 65 seconds elapsed
       
       vi.advanceTimersByTime(16); // Cross into round 2 natively
       expect(callbacks.onIntervalStart).toHaveBeenCalledWith(1, "Round 2");
       
       Date.now = originalNow;
    });
  });

  describe("Fartlek Mode Logic", () => {
    const fartlekConfig: TimerConfig = {
      mode: "fartlek",
      intervalCount: 1,
      intervalSecs: 60,
      activityType: 115,
      includeLocation: false,
      totalDurationSecs: 210,
      phases: [
        { name: "Walk", durationSecs: 60 },
        { name: "Jog", durationSecs: 120 },
        { name: "Run", durationSecs: 30 },
      ],
    };

    it("accurately returns phase info depending on elapsed time natively inside loop", () => {
      const engine = new TimerEngine(fartlekConfig, callbacks);
      engine.start();
      
      // Fast forward 61 seconds (into Jog phase natively)
      vi.advanceTimersByTime(61000);

      expect(callbacks.onTick).toHaveBeenCalled();
      expect(engine.state.currentPhaseIndex).toBe(1);
      expect(engine.state.currentPhaseName).toBe("Jog");
      expect(callbacks.onIntervalStart).toHaveBeenCalledWith(1, "Jog");
      
      // Fast forward past everything
      vi.advanceTimersByTime(300000); 
      expect(engine.state.currentPhaseName).toBe("Run"); // Bounded to max phase length
    });
  });
});
