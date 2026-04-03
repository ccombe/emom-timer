import { TimerConfig, TimerState } from "./types.ts";
import { isFinished, getCountdownBeep, BeepCheck } from "./logic.ts";

export interface TimerCallbacks {
  onTick: (state: TimerState) => void;
  onIntervalStart: (intervalIndex: number, phaseName?: string) => void;
  onCountdownBeep: (freq: number) => void;
  onComplete: () => void;
}

export class TimerEngine {
  public state: TimerState;
  public readonly config: TimerConfig; // Reference to config
  private readonly callbacks: TimerCallbacks;
  private animationFrameId: number = 0;
  private lastIntervalIndex: number = -1;

  constructor(config: TimerConfig, callbacks: TimerCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
    this.state = {
      isRunning: false,
      startTime: 0,
      elapsedPaused: 0,
      lastFrameTime: 0,
      currentTotalElapsed: 0,
      lastBeepSecond: -1,
      location: null,
    };
  }

  public start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    // Adjust start time to respect elapsed
    this.state.startTime = Date.now() - this.state.currentTotalElapsed * 1000;

    if (this.state.currentTotalElapsed === 0) {
      this.lastIntervalIndex = 0;
      // Interval 0 start implies bell, usually handled by checking index > lastIntervalIndex
      // But for 0, we might want to trigger it immediately if logic deems so,
      // or let the loop handle it?
      // In app.ts: "if (state.currentTotalElapsed === 0) { playBell(); ... }"
      // We should fire that callback here?
      // Actually app.ts fired playBell() explicitly on start.
      // Let's fire callback
      this.callbacks.onIntervalStart(0);
    }

    this.tick();
  }

  public pause(): void {
    this.state.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  public reset(): void {
    this.pause();
    this.state.currentTotalElapsed = 0;
    this.state.startTime = 0;
    this.state.location = null;
    this.lastIntervalIndex = -1;
    // Notify UI of reset state
    this.callbacks.onTick(this.state);
  }

  public toggle(): void {
    if (this.state.isRunning) {
      this.pause();
    } else if (this.state.currentTotalElapsed >= this.config.totalDurationSecs) {
      // Logic for restart vs resume handled by caller?
      // Or we just resume.
      // If finished, we should reset?
      this.reset();
      this.start(); // Caller might want countdown though.
    } else {
      this.start();
    }
  }

  private readonly tick = (): void => {
    if (!this.state.isRunning) return;

    const now = Date.now();
    if (!this.state.startTime) this.state.startTime = now;

    const rawElapsed = (now - this.state.startTime) / 1000;
    this.state.currentTotalElapsed = rawElapsed;

    const phaseInfo = this.getCurrentPhaseInfo();
    this.state.currentPhaseIndex = phaseInfo.index;
    this.state.currentPhaseDuration = phaseInfo.duration;
    this.state.currentPhaseElapsed = phaseInfo.elapsedInPhase;
    this.state.currentPhaseName = phaseInfo.name;

    this.handleCountdownLogic(phaseInfo);

    if (this.checkCompletion()) return;

    this.checkIntervalTransition(phaseInfo);

    this.callbacks.onTick(this.state);
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private get isFartlekMode(): boolean {
    return this.config.mode === "fartlek" && Boolean(this.config.phases?.length);
  }

  private getCurrentPhaseInfo() {
    if (this.isFartlekMode && this.config.phases) {
      let accum = 0;
      for (let i = 0; i < this.config.phases.length; i++) {
        const pDuration = this.config.phases[i].durationSecs;
        if (this.state.currentTotalElapsed < accum + pDuration) {
          return {
            index: i,
            duration: pDuration,
            elapsedInPhase: this.state.currentTotalElapsed - accum,
            name: this.config.phases[i].name,
          };
        }
        accum += pDuration;
      }
      // If went over the end, return last phase stats
      const lastIdx = this.config.phases.length - 1;
      const lastPhase = this.config.phases[lastIdx];
      return {
        index: lastIdx,
        duration: lastPhase.durationSecs,
        elapsedInPhase: this.state.currentTotalElapsed - (accum - lastPhase.durationSecs),
        name: lastPhase.name,
      };
    }

    const index = Math.floor(this.state.currentTotalElapsed / this.config.intervalSecs);
    return {
      index,
      duration: this.config.intervalSecs,
      elapsedInPhase: this.state.currentTotalElapsed % this.config.intervalSecs,
      name: `Round ${index + 1}`,
    };
  }

  private handleCountdownLogic(phaseInfo: { elapsedInPhase: number; duration: number }): void {
    const beepCheck: BeepCheck = getCountdownBeep({
      elapsed: phaseInfo.elapsedInPhase,
      intervalDuration: phaseInfo.duration,
      lastBeepId: this.state.lastBeepSecond,
    });

    if (beepCheck.shouldBeep) {
      this.callbacks.onCountdownBeep(beepCheck.frequency);
      this.state.lastBeepSecond = beepCheck.newBeepId;
    }
  }

  private checkCompletion(): boolean {
    if (isFinished(this.state.currentTotalElapsed, this.config.totalDurationSecs)) {
      this.state.currentTotalElapsed = this.config.totalDurationSecs;
      this.pause();
      this.callbacks.onTick(this.state); // Final update
      this.callbacks.onComplete();
      return true;
    }
    return false;
  }

  private checkIntervalTransition(phaseInfo: { index: number; name: string }): void {
    if (phaseInfo.index > this.lastIntervalIndex && phaseInfo.index > 0) {
      this.callbacks.onIntervalStart(phaseInfo.index, phaseInfo.name);
      this.lastIntervalIndex = phaseInfo.index;
    }
  }

  public setLocation(loc: { lat: number; lng: number } | null) {
    this.state.location = loc;
  }
}
