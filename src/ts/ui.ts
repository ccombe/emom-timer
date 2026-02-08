import { TimerConfig, TimerState } from './types.ts';
import {
    formatTime,
    calculateTotalProgress,
    calculateIntervalProgress,
    getCurrentRound,
    isFinished
} from './logic.ts';

export class UIManager {
    // Buttons & Inputs
    public readonly startBtn: HTMLButtonElement;
    public readonly resetBtn: HTMLButtonElement;
    public readonly settingsToggle: HTMLButtonElement;
    public readonly closeSettingsBtn: HTMLButtonElement;
    public readonly connectFitBtn: HTMLButtonElement;

    public readonly intervalCountInput: HTMLInputElement;
    public readonly intervalDurationSelect: HTMLSelectElement;
    public readonly activityTypeSelect: HTMLSelectElement;
    public readonly locationToggle: HTMLInputElement;

    private timerDisplay: HTMLElement;
    private intervalDisplay: HTMLElement;
    private streakDisplay: HTMLElement;
    private totalRing: SVGCircleElement;
    private intervalRing: SVGCircleElement;
    private trophyOverlay: HTMLElement;
    private settingsPanel: HTMLElement;

    private fitStatus: HTMLElement;
    private fitIcon: HTMLElement;

    // SVG Constants
    private readonly TOTAL_CIRCUMFERENCE: number = 2 * Math.PI * 40;
    private readonly INTERVAL_CIRCUMFERENCE: number = 2 * Math.PI * 70;

    constructor() {
        this.timerDisplay = document.getElementById('timer-display') as HTMLElement;
        this.intervalDisplay = document.getElementById('interval-display') as HTMLElement;
        this.streakDisplay = document.getElementById('streak-display') as HTMLElement;

        this.totalRing = document.getElementById('total-ring-fg') as unknown as SVGCircleElement;
        this.intervalRing = document.getElementById('interval-ring-fg') as unknown as SVGCircleElement;

        this.startBtn = document.getElementById('start-btn') as HTMLButtonElement;
        this.resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
        this.trophyOverlay = document.getElementById('trophy-overlay') as HTMLElement;

        // Settings
        this.settingsToggle = document.getElementById('settings-toggle') as HTMLButtonElement;
        this.settingsPanel = document.getElementById('settings-panel') as HTMLElement;
        this.closeSettingsBtn = document.getElementById('close-settings-btn') as HTMLButtonElement;

        this.intervalCountInput = document.getElementById('interval-count-input') as HTMLInputElement;
        this.intervalDurationSelect = document.getElementById('interval-duration-select') as HTMLSelectElement;
        this.activityTypeSelect = document.getElementById('activity-type-select') as HTMLSelectElement;
        this.locationToggle = document.getElementById('location-toggle') as HTMLInputElement;

        this.connectFitBtn = document.getElementById('connect-google-fit-btn') as HTMLButtonElement;
        this.fitStatus = document.getElementById('google-fit-status') as HTMLElement;
        this.fitIcon = document.getElementById('fit-status-icon') as HTMLElement;
    }

    public updateDisplay(state: TimerState, config: TimerConfig): void {
        const totalElapsed = state.currentTotalElapsed;

        // Total Progress
        const totalProgress = calculateTotalProgress({ elapsed: totalElapsed, totalDuration: config.totalDurationSecs });
        const totalDashOffset = this.TOTAL_CIRCUMFERENCE * (1 - totalProgress);
        this.totalRing.style.strokeDashoffset = totalDashOffset.toString();

        // Interval Progress
        const intervalProgress = calculateIntervalProgress({ elapsed: totalElapsed, intervalDuration: config.intervalSecs });
        const intervalDashOffset = this.INTERVAL_CIRCUMFERENCE * (1 - intervalProgress);
        this.intervalRing.style.strokeDashoffset = intervalDashOffset.toString();

        // Timer Text
        const currentIntervalSec = totalElapsed % config.intervalSecs;
        const intervalTimerVal = Math.floor(currentIntervalSec);
        this.timerDisplay.textContent = formatTime(intervalTimerVal);

        // Rounds
        const { current, total } = getCurrentRound({
            elapsed: totalElapsed,
            intervalDuration: config.intervalSecs,
            totalDuration: config.totalDurationSecs
        });

        if (isFinished(totalElapsed, config.totalDurationSecs)) {
            this.intervalDisplay.textContent = "Done!";
            this.timerDisplay.textContent = formatTime(0);
            document.title = "Done! - EMOM Timer";
        } else {
            this.intervalDisplay.textContent = `Round ${current}/${total}`;
            document.title = `${formatTime(intervalTimerVal)} - EMOM Timer`;
        }
    }

    public updateStreak(streak: number): void {
        if (this.streakDisplay) {
            this.streakDisplay.innerText = `Streak: ${streak} day${streak === 1 ? '' : 's'}`;
        }
    }

    public updateFitUI(status: 'disconnected' | 'connected' | 'syncing'): void {
        this.fitIcon.classList.remove('connected', 'syncing');

        if (status === 'connected') {
            this.fitIcon.classList.add('connected');
            this.fitIcon.title = "Google Fit: Connected";
        } else if (status === 'syncing') {
            this.fitIcon.classList.add('connected', 'syncing');
            this.fitIcon.title = "Google Fit: Syncing...";
        } else {
            this.fitIcon.title = "Google Fit: Disconnected";
        }
    }

    public setFitConnectedState(): void {
        this.fitStatus.textContent = "Connected";
        this.fitStatus.style.color = "#4caf50";
        this.connectFitBtn.style.display = 'none';
        this.updateFitUI('connected');
    }

    public triggerVictoryVisuals(): void {
        document.body.classList.add('victory');
        this.trophyOverlay.classList.add('show');
    }

    public clearVisuals(): void {
        document.body.classList.remove('victory');
        this.trophyOverlay.classList.remove('show');
    }

    public toggleSettings(visible: boolean): void {
        if (visible) {
            this.settingsPanel.classList.add('visible');
        } else {
            this.settingsPanel.classList.remove('visible');
        }
    }

    public setSettingsInputs(config: TimerConfig): void {
        this.intervalCountInput.value = config.intervalCount.toString();
        this.intervalDurationSelect.value = config.intervalSecs.toString();
        if (this.activityTypeSelect) this.activityTypeSelect.value = config.activityType.toString();
        if (this.locationToggle) this.locationToggle.checked = config.includeLocation;
    }

    public setStartBtnText(text: string): void {
        this.startBtn.innerText = text;
    }

    public setStartBtnDisabled(disabled: boolean): void {
        this.startBtn.disabled = disabled;
    }

    public setSettingsLocked(locked: boolean): void {
        this.settingsToggle.style.pointerEvents = locked ? 'none' : 'all';
    }

    public showCountdown(count: number): void {
        this.timerDisplay.textContent = "READY";
        this.intervalDisplay.textContent = "Starting in " + count;
    }

    public showToast(message: string): void {
        const originalText = this.intervalDisplay.textContent;
        this.intervalDisplay.textContent = message;
        setTimeout(() => {
            if (this.intervalDisplay.textContent === message) {
                this.intervalDisplay.textContent = originalText;
            }
        }, 3000);
    }
}
