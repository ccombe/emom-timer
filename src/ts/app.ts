// --- Imports ---
import {
    calculateStreak,
    normalizeConfig
} from './logic.ts';
import { StorageService } from './storage.ts';
import { googleFit } from './google-fit.ts';
import { TimerConfig, TimerState } from './types.ts';
import { AudioManager } from './audio.ts';
import { UIManager } from './ui.ts';
import { TimerEngine, TimerCallbacks } from './timer-engine.ts';

// --- Initialization ---
const storage = new StorageService();
const audio = new AudioManager();
const ui = new UIManager();

// --- Configuration ---
let CONFIG: TimerConfig = {
    intervalCount: 5,           // Default 5 rounds
    intervalSecs: 60,           // 1 minute
    activityType: 115,          // Default Kettlebell
    includeLocation: false,     // Default Off
    get totalDurationSecs() {
        return this.intervalCount * this.intervalSecs;
    }
};

// --- Engine Callbacks ---
const callbacks: TimerCallbacks = {
    onTick: (state: TimerState) => {
        ui.updateDisplay(state, CONFIG);
    },
    onIntervalStart: (_index: number) => {
        audio.playBell();
    },
    onCountdownBeep: (freq: number) => {
        audio.playCountdownBeep(freq);
    },
    onComplete: () => {
        audio.playEndSound();
        ui.triggerVictoryVisuals();
        saveWorkout();
    }
};

const engine = new TimerEngine(CONFIG, callbacks);

// --- Event Listeners for Fit Status ---
document.addEventListener('google-fit-connected', () => {
    ui.setFitConnectedState(); // Update button text and status
    // Refresh Streak with Cloud Data
    updateStreak();
});
document.addEventListener('google-fit-sync-success', () => {
    ui.updateFitUI('connected');
    ui.showSyncConfirmation(); // Show toast with visual confirmation
});
document.addEventListener('google-fit-sync-error', () => {
    ui.updateFitUI('connected'); // Still connected, just failed sync
    ui.showSyncError(); // Show error toast
});

// --- Actions ---

function tryAcquireLocation() {
    if (!googleFit.isConnected() || !CONFIG.includeLocation) {
        return;
    }

    if (!navigator.geolocation || engine.state.location) {
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            engine.setLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            });
            console.log("Location acquired.");
        },
        (err) => console.warn("Location denied/error", err),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
}

function runCountdownSequence(startCount: number, onComplete: () => void) {
    let count = startCount;
    ui.showCountdown(count);
    audio.playCountdownBeep(440); // 3 (Low)

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            ui.showCountdown(count);
            // Beep pitch up
            let freq = 440;
            if (count === 2) freq = 554;
            if (count === 1) freq = 659;
            audio.playCountdownBeep(freq);
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
        engine.start();
    });
}

function toggleTimer() {
    if (engine.state.isRunning) {
        engine.pause();
        ui.setStartBtnText("Resume");
    } else {
        if (engine.state.currentTotalElapsed >= CONFIG.totalDurationSecs) {
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
}

function resetTimer() {
    engine.reset();
    ui.setStartBtnText("Start");
    ui.clearVisuals();
    ui.updateDisplay(engine.state, CONFIG);
}

// --- Data Persistence ---

async function saveWorkout() {
    await storage.saveSession({
        duration: CONFIG.totalDurationSecs,
        interval: CONFIG.intervalSecs,
        activityType: CONFIG.activityType || 115,
        location: engine.state.location
    });
    updateStreak();

    // Sync if connected
    if (googleFit.isConnected()) {
        googleFit.uploadSession({
            duration: CONFIG.totalDurationSecs,
            activityType: CONFIG.activityType || 115,
            interval: CONFIG.intervalSecs,
            location: engine.state.location
        });
    }
}

async function updateStreak() {
    const localStreak = await storage.getStreak();
    let displayStreak = localStreak;

    // Check Cloud Streak if connected
    if (googleFit.isConnected()) {
        try {
            const historyDates = await googleFit.fetchWorkoutHistory();
            if (historyDates && historyDates.length > 0) {
                const dateObjects = historyDates.map(ts => new Date(ts));
                const cloudStreak = calculateStreak(dateObjects);
                displayStreak = Math.max(localStreak, cloudStreak);
            }
        } catch (e) {
            console.warn("Retaining local streak due to fetch error", e);
        }
    }
    ui.updateStreak(displayStreak);
}

// --- Event Binding ---
ui.startBtn.addEventListener('click', toggleTimer);
ui.resetBtn.addEventListener('click', resetTimer);

// Post-trophy continue button
const continueBtn = document.getElementById('trophy-continue-btn');
if (continueBtn) {
    continueBtn.addEventListener('click', () => {
        resetTimer();
        ui.clearVisuals();
    });
}

ui.settingsToggle.addEventListener('click', () => {
    ui.toggleSettings(true); // Open
    audio.ensureAudioContext();
    if (googleFit.isConnected()) {
        ui.setFitConnectedState();
    }
});

ui.closeSettingsBtn.addEventListener('click', () => {
    ui.toggleSettings(false); console.log('Applying settings...');
    audio.ensureAudioContext();
    applySettings();
});

ui.connectFitBtn.addEventListener('click', () => {
    googleFit.initialize();
    googleFit.connect();
    // Success handled by event listener above
});

function applySettings() {
    const newSettings = {
        intervalCount: parseInt(ui.intervalCountInput.value) || 1,
        intervalSecs: parseInt(ui.intervalDurationSelect.value),
        activityType: parseInt(ui.activityTypeSelect.value) || 115,
        includeLocation: ui.locationToggle.checked
    };

    saveAndApplyConfig(newSettings);
    handleLocationUpdate(newSettings.includeLocation);
    handleTimerUpdate(newSettings.intervalCount, newSettings.intervalSecs);
}

function saveAndApplyConfig(settings: { intervalCount: number, intervalSecs: number, activityType: number, includeLocation: boolean }) {
    storage.saveSettings({ ...settings, setupComplete: true });

    CONFIG.activityType = settings.activityType;
    CONFIG.includeLocation = settings.includeLocation;
}

function handleLocationUpdate(newIncludeLocation: boolean) {
    const shouldAcquire = newIncludeLocation && !CONFIG.includeLocation && googleFit.isConnected();
    if (shouldAcquire) {
        tryAcquireLocation();
    }
}

function handleTimerUpdate(newIntervalCount: number, newIntervalSecs: number) {
    const timerParamsChanged = newIntervalCount !== CONFIG.intervalCount ||
        newIntervalSecs !== CONFIG.intervalSecs;

    if (timerParamsChanged) {
        CONFIG.intervalCount = newIntervalCount;
        CONFIG.intervalSecs = newIntervalSecs;
        resetTimer();
    } else {
        // Just update config for non-timer-structural changes
        CONFIG.intervalCount = newIntervalCount;
        CONFIG.intervalSecs = newIntervalSecs;

        // Refresh display if not running to ensure fresh state visibility
        if (!engine.state.isRunning) {
            ui.updateDisplay(engine.state, CONFIG);
        }
    }
}

// --- Init ---

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

async function init() {
    const setupComplete = await loadSettings();

    if (!setupComplete) {
        setTimeout(() => ui.toggleSettings(true), 500);
    }

    ui.updateDisplay(engine.state, CONFIG);
    updateStreak();

    if (googleFit.isConnected()) {
        ui.updateFitUI('connected');
    }
}

init();
