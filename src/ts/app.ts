// --- Imports ---
import { calculateStreak, normalizeConfig, getBeepFrequency } from "./logic.ts";
import { StorageService } from "./storage.ts";
import { googleFit } from "./google-fit.ts";
import { TimerConfig, TimerState, TimerMode } from "./types.ts";
import { AudioManager } from "./audio.ts";
import { MediaSessionAdapter } from "./adapters.ts";
import { UIManager } from "./ui.ts";
import { TimerEngine, TimerCallbacks } from "./timer-engine.ts";

// --- Initialization ---
const storage = new StorageService();
const audio = new AudioManager();
const ui = new UIManager();
const mediaSession = new MediaSessionAdapter();

// --- Configuration ---
const CONFIG: TimerConfig = {
  mode: "emom",
  intervalCount: 5,
  intervalSecs: 60,
  activityType: 115,
  includeLocation: false,
  get totalDurationSecs() {
    if (this.mode === "fartlek" && this.phases) {
      return this.phases.reduce((acc, phase) => acc + phase.durationSecs, 0);
    }
    return this.intervalCount * this.intervalSecs;
  },
};

// --- Engine Callbacks ---
const callbacks: TimerCallbacks = {
  onTick: (state: TimerState) => {
    ui.updateDisplay(state, CONFIG);
  },
  onIntervalStart: (_index: number, phaseName?: string) => {
    if (CONFIG.mode === "fartlek" && phaseName) {
      audio.announcePhase(phaseName);
    } else {
      audio.playBell();
    }
  },
  onCountdownBeep: (freq: number) => {
    audio.playCountdownBeep(freq);
  },
  onComplete: () => {
    audio.releaseLockScreenAudio();
    audio.playEndSound();
    ui.triggerVictoryVisuals();
    void saveWorkout();
  },
};

const engine = new TimerEngine(CONFIG, callbacks);

// --- Event Listeners for Fit Status ---
document.addEventListener("google-fit-connected", () => {
  ui.setFitConnectedState(); // Update button text and status
  // Refresh Streak with Cloud Data
  void updateStreak();
});
document.addEventListener("google-fit-sync-success", () => {
  ui.updateFitUI("connected");
  ui.showSyncConfirmation(); // Show toast with visual confirmation
});
document.addEventListener("google-fit-sync-error", () => {
  ui.updateFitUI("connected"); // Still connected, just failed sync
  ui.showSyncError(); // Show error toast
});

// --- Actions ---

function canAcquireLocation(): boolean {
  const wantsLocation = googleFit.isConnected() && CONFIG.includeLocation;
  const geoReady = Boolean(navigator.geolocation) && !engine.state.location;
  return wantsLocation && geoReady;
}

function onGeolocationSuccess(pos: GeolocationPosition): void {
  engine.setLocation({
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
  });
}

function tryAcquireLocation(): void {
  if (!canAcquireLocation()) return;
  navigator.geolocation.getCurrentPosition(
    onGeolocationSuccess,
    () => {},
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
  );
}

function runCountdownSequence(startCount: number, onComplete: () => void) {
  let count = startCount;
  ui.showCountdown(count);
  audio.playCountdownBeep(getBeepFrequency(count));

  const countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      ui.showCountdown(count);
      audio.playCountdownBeep(getBeepFrequency(count));
    } else {
      clearInterval(countdownInterval);
      onComplete();
    }
  }, 1000);
}

function startWithCountdown() {
  ui.clearVisuals();
  ui.setStartBtnDisabled(true);
  ui.setSettingsLocked(true);

  tryAcquireLocation();

  runCountdownSequence(3, () => {
    ui.setStartBtnDisabled(false);
    ui.setSettingsLocked(false);
    ui.setStartBtnText("Pause");
    audio.maintainLockScreenAudio();
    engine.start();
  });
}

function toggleTimer() {
  if (engine.state.isRunning) {
    engine.pause();
    ui.setStartBtnText("Resume");
  } else if (engine.state.currentTotalElapsed >= CONFIG.totalDurationSecs) {
    engine.reset();
    startWithCountdown();
  } else if (engine.state.currentTotalElapsed === 0) {
    startWithCountdown();
  } else {
    // Resume
    ui.setStartBtnText("Pause");
    engine.start();
  }
}

function resetTimer() {
  engine.reset();
  audio.releaseLockScreenAudio();
  ui.setStartBtnText("Start");
  ui.clearVisuals();
  ui.updateDisplay(engine.state, CONFIG);
}

// --- Data Persistence ---

function buildWorkoutSession() {
  return {
    duration: CONFIG.totalDurationSecs,
    interval: CONFIG.intervalSecs,
    activityType: CONFIG.activityType || 115,
    location: engine.state.location,
  };
}

async function saveWorkout() {
  await storage.saveSession(buildWorkoutSession());
  void updateStreak();

  if (googleFit.isConnected()) {
    void googleFit.uploadSession(buildWorkoutSession());
  }
}

async function fetchConnectedCloudStreak(localStreak: number): Promise<number> {
  const historyDates = await googleFit.fetchWorkoutHistory();
  if (!historyDates?.length) return localStreak;
  const cloudStreak = calculateStreak(historyDates.map((ts) => new Date(ts)));
  return Math.max(localStreak, cloudStreak);
}

async function mergeCloudStreak(localStreak: number): Promise<number> {
  if (!googleFit.isConnected()) return localStreak;
  try {
    return await fetchConnectedCloudStreak(localStreak);
  } catch {
    return localStreak;
  }
}

async function updateStreak(): Promise<void> {
  const localStreak = await storage.getStreak();
  const displayStreak = await mergeCloudStreak(localStreak);
  ui.updateStreak(displayStreak);
}

// --- Event Binding ---
ui.startBtn.addEventListener("click", toggleTimer);
ui.resetBtn.addEventListener("click", resetTimer);

// Post-trophy continue button
const continueBtn = document.getElementById("trophy-continue-btn");
if (continueBtn) {
  continueBtn.addEventListener("click", () => {
    resetTimer();
    ui.clearVisuals();
  });
}

ui.settingsToggle.addEventListener("click", () => {
  ui.showSettings(); // Open
  audio.ensureAudioContext();
  if (googleFit.isConnected()) {
    ui.setFitConnectedState();
  }
});

ui.closeSettingsBtn.addEventListener("click", () => {
  ui.hideSettings();
  audio.ensureAudioContext();
  applySettings();
});

ui.timerModeSelect.addEventListener("change", () => {
  if (ui.timerModeSelect.value === "fartlek") {
    // Auto populate activity type to "Running / Fartlek" (8)
    ui.activityTypeSelect.value = "8";
  } else if (ui.timerModeSelect.value === "emom" && ui.activityTypeSelect.value === "8") {
    // Revert back to Kettlebell for EMOM if it was strictly on Running
    ui.activityTypeSelect.value = "115";
  }
});

ui.connectFitBtn.addEventListener("click", () => {
  googleFit.initialize();
  googleFit.connect();
  // Success handled by event listener above
});

function getDefaultFartlekPhases() {
  return [
    { name: "Walk", durationSecs: 60 },
    { name: "Jog", durationSecs: 120 },
    { name: "Walk", durationSecs: 60 },
    { name: "Run", durationSecs: 30 }
  ];
}

type SettingsFormSnapshot = {
  mode: TimerMode;
  phases?: TimerConfig["phases"];
  intervalCount: number;
  intervalSecs: number;
  activityType: number;
  includeLocation: boolean;
};

function readTimerModeFromUi(): TimerMode {
  return ui.timerModeSelect.value as TimerMode;
}

function fartlekPhasesForMode(mode: TimerMode): TimerConfig["phases"] | undefined {
  if (mode !== "fartlek") return undefined;
  return CONFIG.phases?.length ? CONFIG.phases : getDefaultFartlekPhases();
}

function readIntervalFieldsFromDom(): Pick<
  SettingsFormSnapshot,
  "intervalCount" | "intervalSecs" | "activityType" | "includeLocation"
> {
  return {
    intervalCount: Number.parseInt(ui.intervalCountInput.value) || 1,
    intervalSecs: Number.parseInt(ui.intervalDurationSelect.value),
    activityType: Number.parseInt(ui.activityTypeSelect.value) || 115,
    includeLocation: ui.locationToggle.checked,
  };
}

function readSettingsFormSnapshot(): SettingsFormSnapshot {
  const modeVal = readTimerModeFromUi();
  return {
    mode: modeVal,
    phases: fartlekPhasesForMode(modeVal),
    ...readIntervalFieldsFromDom(),
  };
}

function applySettings(): void {
  const newSettings = readSettingsFormSnapshot();
  const oldIncludeLocation = CONFIG.includeLocation;
  const oldMode = CONFIG.mode;
  saveAndApplyConfig(newSettings);
  handleLocationUpdate(newSettings.includeLocation, oldIncludeLocation);
  handleTimerUpdate(newSettings.intervalCount, newSettings.intervalSecs, newSettings.mode, oldMode);
}

function saveAndApplyConfig(settings: SettingsFormSnapshot): void {
  void storage.saveSettings({ ...settings, setupComplete: true });

  CONFIG.mode = settings.mode;
  if (settings.phases) CONFIG.phases = settings.phases;
  CONFIG.activityType = settings.activityType;
  CONFIG.includeLocation = settings.includeLocation;
}

function handleLocationUpdate(newIncludeLocation: boolean, oldIncludeLocation: boolean) {
  // Check if toggled ON
  const shouldAcquire = newIncludeLocation && !oldIncludeLocation && googleFit.isConnected();
  if (shouldAcquire) {
    tryAcquireLocation();
  }
}

function timerDurationShapeChanged(
  newIntervalCount: number,
  newIntervalSecs: number,
  newMode: TimerMode,
  oldMode: TimerMode,
): boolean {
  return (
    newIntervalCount !== CONFIG.intervalCount ||
    newIntervalSecs !== CONFIG.intervalSecs ||
    newMode !== oldMode
  );
}

function applyIntervalConfig(count: number, secs: number): void {
  CONFIG.intervalCount = count;
  CONFIG.intervalSecs = secs;
}

function handleTimerUpdate(
  newIntervalCount: number,
  newIntervalSecs: number,
  newMode: TimerMode,
  oldMode: TimerMode,
): void {
  const shapeChanged = timerDurationShapeChanged(newIntervalCount, newIntervalSecs, newMode, oldMode);
  applyIntervalConfig(newIntervalCount, newIntervalSecs);
  if (shapeChanged) {
    resetTimer();
    return;
  }
  if (!engine.state.isRunning) {
    ui.updateDisplay(engine.state, CONFIG);
  }
}

// --- Init ---
mediaSession.configure({
  title: "Workout Timer",
  artist: "EMOM Timer",
  onPlay: toggleTimer,
  onPause: toggleTimer,
});

async function loadSettings() {
  const settings = await storage.loadSettings();

  if (settings) {
    const normalized = normalizeConfig(settings, CONFIG);

    // Update in-place to preserve reference for engine
    CONFIG.intervalCount = normalized.intervalCount;
    CONFIG.intervalSecs = normalized.intervalSecs;
    CONFIG.activityType = normalized.activityType;
    CONFIG.includeLocation = normalized.includeLocation;

    // Apply to UI
    ui.setSettingsInputs(CONFIG);

    return settings.setupComplete;
  }
  return false;
}

await storage.init();
const setupComplete = await loadSettings();

if (!setupComplete) {
  setTimeout(() => ui.showSettings(), 500);
}

ui.updateDisplay(engine.state, CONFIG);
await updateStreak();

if (googleFit.isConnected()) {
  ui.updateFitUI("connected");
}
