import { TimerConfig, TimerState } from './types.ts';
import { isFinished, getCountdownBeep, BeepCheck } from './logic.ts';

export interface TimerCallbacks {
    onTick: (state: TimerState) => void;
    onIntervalStart: (intervalIndex: number) => void;
    onCountdownBeep: (freq: number) => void;
    onComplete: () => void;
}

export class TimerEngine {
    public state: TimerState;
    public config: TimerConfig; // Reference to config
    private callbacks: TimerCallbacks;
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
            location: null
        };
    }

    public start(): void {
        if (this.state.isRunning) return;

        this.state.isRunning = true;
        // Adjust start time to respect elapsed
        this.state.startTime = Date.now() - (this.state.currentTotalElapsed * 1000);

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
        } else {
            // Logic for restart vs resume handled by caller? 
            // Or we just resume.
            // If finished, we should reset?
            if (this.state.currentTotalElapsed >= this.config.totalDurationSecs) {
                this.reset();
                this.start(); // Caller might want countdown though.
            } else {
                this.start();
            }
        }
    }

    private tick = (): void => {
        if (!this.state.isRunning) return;

        const now = Date.now();
        if (!this.state.startTime) this.state.startTime = now;

        const rawElapsed = (now - this.state.startTime) / 1000;
        this.state.currentTotalElapsed = rawElapsed;

        this.handleCountdownLogic();

        if (this.checkCompletion()) return;

        this.checkIntervalTransition();

        this.callbacks.onTick(this.state);
        this.animationFrameId = requestAnimationFrame(this.tick);
    }

    private handleCountdownLogic(): void {
        const beepCheck: BeepCheck = getCountdownBeep({
            elapsed: this.state.currentTotalElapsed,
            intervalDuration: this.config.intervalSecs,
            lastBeepId: this.state.lastBeepSecond
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

    private checkIntervalTransition(): void {
        const currentIntervalIndex = Math.floor(this.state.currentTotalElapsed / this.config.intervalSecs);
        if (currentIntervalIndex > this.lastIntervalIndex && currentIntervalIndex > 0) {
            this.callbacks.onIntervalStart(currentIntervalIndex);
            this.lastIntervalIndex = currentIntervalIndex;
        }
    }

    public setLocation(loc: { lat: number; lng: number } | null) {
        this.state.location = loc;
    }
}
