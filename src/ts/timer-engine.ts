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
  public readonly config: TimerConfig;
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
    this.state.startTime = Date.now() - this.state.currentTotalElapsed * 1000;

    if (this.state.currentTotalElapsed === 0) {
      this.lastIntervalIndex = 0;
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
    this.callbacks.onTick(this.state);
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

  private findFartlekPhaseInfo() {
    const phases = this.config.phases;
    if (!phases) {
      return { index: 0, duration: 0, elapsedInPhase: 0, name: "" };
    }
    let accum = 0;
    for (let i = 0; i < phases.length; i++) {
      const pDuration = phases[i].durationSecs;
      if (this.state.currentTotalElapsed < accum + pDuration) {
        return {
          index: i,
          duration: pDuration,
          elapsedInPhase: this.state.currentTotalElapsed - accum,
          name: phases[i].name,
        };
      }
      accum += pDuration;
    }
    const lastIdx = phases.length - 1;
    const lastPhase = phases[lastIdx];
    return {
      index: lastIdx,
      duration: lastPhase.durationSecs,
      elapsedInPhase: this.state.currentTotalElapsed - (accum - lastPhase.durationSecs),
      name: lastPhase.name,
    };
  }

  private getCurrentPhaseInfo() {
    if (this.isFartlekMode && this.config.phases) {
      return this.findFartlekPhaseInfo();
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
      this.callbacks.onTick(this.state);
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
