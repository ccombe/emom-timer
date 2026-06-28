import { TimerConfig, TimerState } from "./types.ts";
import {
  formatTime,
  calculateTotalProgress,
  getCurrentRound,
  isFinished,
} from "./logic.ts";

function queryById<T extends Element>(
  id: string,
  ctor: abstract new (...args: unknown[]) => T,
): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing required element #${id}`);
  }
  if (!(el instanceof ctor)) {
    throw new Error(`Element #${id} is not a ${ctor.name}`);
  }
  return el;
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

const TOAST_ICONS: Record<string, string> = {
  success: "\u2705",
  error: "\u274c",
  info: "\u2139\ufe0f",
};

const MS = {
  TOAST_FADE: 200,
  TOAST_DEFAULT: 3000,
  VICTORY_BUTTON_DELAY: 2000,
  PULSE_DURATION: 500,
};

export class UIManager {
  public startBtn: HTMLButtonElement;
  public resetBtn: HTMLButtonElement;
  public settingsToggle: HTMLButtonElement;
  public closeSettingsBtn: HTMLButtonElement;
  public connectFitBtn: HTMLButtonElement;

  public timerModeSelect: HTMLSelectElement;
  public intervalCountInput: HTMLInputElement;
  public intervalDurationSelect: HTMLSelectElement;
  public activityTypeSelect: HTMLSelectElement;
  public locationToggle: HTMLInputElement;

  private timerDisplay: HTMLElement;
  private intervalDisplay: HTMLElement;
  private streakDisplay: HTMLElement;
  private totalRing: SVGCircleElement;
  private intervalRing: SVGCircleElement;
  private trophyOverlay: HTMLElement;
  private settingsPanel: HTMLElement;

  private fitStatus: HTMLElement;
  private fitIcon: HTMLElement;
  private toastContainer: HTMLElement;
  private trophyContinueBtn: HTMLButtonElement;

  private readonly TOTAL_CIRCUMFERENCE: number = 2 * Math.PI * 40;
  private readonly INTERVAL_CIRCUMFERENCE: number = 2 * Math.PI * 70;

  constructor() {
    this.timerDisplay = queryById("timer-display", HTMLElement);
    this.intervalDisplay = queryById("interval-display", HTMLElement);
    this.streakDisplay = queryById("streak-display", HTMLElement);
    this.totalRing = queryById("total-ring-fg", SVGCircleElement);
    this.intervalRing = queryById("interval-ring-fg", SVGCircleElement);

    this.startBtn = queryById("start-btn", HTMLButtonElement);
    this.resetBtn = queryById("reset-btn", HTMLButtonElement);
    this.trophyOverlay = queryById("trophy-overlay", HTMLElement);
    this.trophyContinueBtn = queryById("trophy-continue-btn", HTMLButtonElement);

    this.settingsToggle = queryById("settings-toggle", HTMLButtonElement);
    this.settingsPanel = queryById("settings-panel", HTMLElement);
    this.closeSettingsBtn = queryById("close-settings-btn", HTMLButtonElement);
    this.timerModeSelect = queryById("timer-mode-select", HTMLSelectElement);
    this.intervalCountInput = queryById("interval-count-input", HTMLInputElement);
    this.intervalDurationSelect = queryById("interval-duration-select", HTMLSelectElement);
    this.activityTypeSelect = queryById("activity-type-select", HTMLSelectElement);
    this.locationToggle = queryById("location-toggle", HTMLInputElement);

    this.connectFitBtn = queryById("connect-google-fit-btn", HTMLButtonElement);
    this.fitStatus = queryById("google-fit-status", HTMLElement);
    this.fitIcon = queryById("fit-status-icon", HTMLElement);
    this.toastContainer = queryById("toast-container", HTMLElement);
  }

  public updateDisplay(state: TimerState, config: TimerConfig): void {
    const totalElapsed = state.currentTotalElapsed;
    const phaseElapsed = state.currentPhaseElapsed ?? (totalElapsed % config.intervalSecs);
    const phaseDuration = state.currentPhaseDuration ?? config.intervalSecs;

    this.updateProgressRings(totalElapsed, phaseElapsed, phaseDuration, config.totalDurationSecs);
    const intervalTimerVal = Math.floor(phaseDuration - phaseElapsed);
    this.timerDisplay.textContent = formatTime(intervalTimerVal);
    this.updateIntervalLabelAndTitle(state, config, totalElapsed, intervalTimerVal);
  }

  private updateProgressRings(
    totalElapsed: number,
    phaseElapsed: number,
    phaseDuration: number,
    totalDurationSecs: number,
  ): void {
    const totalProgress = calculateTotalProgress({
      elapsed: totalElapsed,
      totalDuration: totalDurationSecs,
    });
    this.totalRing.style.strokeDashoffset = (this.TOTAL_CIRCUMFERENCE * (1 - totalProgress)).toString();

    const intervalProgress = phaseElapsed / phaseDuration;
    this.intervalRing.style.strokeDashoffset = (
      this.INTERVAL_CIRCUMFERENCE * intervalProgress
    ).toString();
  }

  private updateIntervalLabelAndTitle(
    state: TimerState,
    config: TimerConfig,
    totalElapsed: number,
    intervalTimerVal: number,
  ): void {
    if (isFinished(totalElapsed, config.totalDurationSecs)) {
      this.intervalDisplay.textContent = "Done!";
      this.timerDisplay.textContent = formatTime(0);
      document.title = "Done! - EMOM Timer";
      return;
    }
    this.intervalDisplay.textContent = this.resolveIntervalLabelText(state, config, totalElapsed);
    document.title = `${formatTime(intervalTimerVal)} - EMOM Timer`;
  }

  private resolveIntervalLabelText(
    state: TimerState,
    config: TimerConfig,
    totalElapsed: number,
  ): string {
    if (state.currentPhaseName) {
      return state.currentPhaseName;
    }
    const { current, total } = getCurrentRound({
      elapsed: totalElapsed,
      intervalDuration: config.intervalSecs,
      totalDuration: config.totalDurationSecs,
    });
    return `Round ${current}/${total}`;
  }

  public updateStreak(streak: number): void {
    this.streakDisplay.textContent = `Streak: ${streak} day${streak === 1 ? "" : "s"}`;
  }

  public updateFitUI(status: "disconnected" | "connected" | "syncing"): void {
    this.fitIcon.classList.remove("connected", "syncing");

    switch (status) {
      case "connected":
        this.fitIcon.classList.add("connected");
        this.fitIcon.title = "Google Fit: Connected";
        break;
      case "syncing":
        this.fitIcon.classList.add("connected", "syncing");
        this.fitIcon.title = "Google Fit: Syncing...";
        break;
      default:
        this.fitIcon.title = "Google Fit: Disconnected";
    }
  }

  public setFitConnectedState(): void {
    this.fitStatus.textContent = "Connected";
    this.fitStatus.style.color = "#4caf50";
    this.connectFitBtn.style.display = "none";
    this.updateFitUI("connected");
  }

  public triggerVictoryVisuals(): void {
    document.body.classList.add("victory");
    this.trophyOverlay.classList.add("show");

    setTimeout(() => {
      this.trophyContinueBtn.style.display = "block";
    }, MS.VICTORY_BUTTON_DELAY);
  }

  public clearVisuals(): void {
    this.withTransition(() => {
      document.body.classList.remove("victory");
      this.trophyOverlay.classList.remove("show");
    });
    this.trophyContinueBtn.style.display = "none";
  }

  private withTransition(action: () => void): void {
    const doc = document as DocumentWithViewTransition;
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(action);
    } else {
      action();
    }
  }

  public showSettings(): void {
    this.withTransition(() => {
      this.settingsPanel.classList.add("visible");
    });
  }

  public hideSettings(): void {
    this.withTransition(() => {
      this.settingsPanel.classList.remove("visible");
    });
  }

  public setSettingsInputs(config: TimerConfig): void {
    this.timerModeSelect.value = config.mode || "emom";
    this.intervalCountInput.value = config.intervalCount.toString();
    this.intervalDurationSelect.value = config.intervalSecs.toString();
    this.activityTypeSelect.value = config.activityType.toString();
    this.locationToggle.checked = config.includeLocation;
  }

  public setStartBtnText(text: string): void {
    this.startBtn.textContent = text;
  }

  public setStartBtnDisabled(disabled: boolean): void {
    this.startBtn.disabled = disabled;
  }

  public setSettingsLocked(locked: boolean): void {
    this.settingsToggle.style.pointerEvents = locked ? "none" : "all";
  }

  public showCountdown(count: number): void {
    this.timerDisplay.textContent = "READY";
    this.intervalDisplay.textContent = `Starting in ${count}`;
  }

  public showToast(
    message: string,
    type: "success" | "error" | "info" = "info",
    duration: number = MS.TOAST_DEFAULT,
  ): void {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icon = TOAST_ICONS[type] ?? TOAST_ICONS.info;
    const iconSpan = document.createElement("span");
    iconSpan.textContent = icon;
    const msgSpan = document.createElement("span");
    msgSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("toast-hiding");
      setTimeout(() => toast.remove(), MS.TOAST_FADE);
    }, duration);
  }

  public showSyncConfirmation(): void {
    this.showToast("Saved to Google Fit!", "success", MS.TOAST_DEFAULT);

    this.fitIcon.style.animation = "none";
    void this.fitIcon.offsetWidth;
    this.fitIcon.style.animation = `pulse-blue ${MS.PULSE_DURATION}ms ease-out`;
    setTimeout(() => {
      this.fitIcon.style.animation = "";
    }, MS.PULSE_DURATION);
  }

  public showSyncError(): void {
    this.showToast("Failed to sync to Google Fit", "error", 4000);
  }
}
