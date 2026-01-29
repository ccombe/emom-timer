import { formatTime, calculateTotalProgress, calculateIntervalProgress, getCurrentRound, getCountdownBeep, isFinished } from './logic.js';

// --- State ---
let CONFIG = {
    totalDurationSecs: 10 * 60, // 10 minutes
    intervalSecs: 60,           // 1 minute
};

let state = {
    isRunning: false,
    startTime: 0,
    elapsedPaused: 0,
    lastFrameTime: 0,
    currentTotalElapsed: 0, // In seconds
    lastBeepSecond: -1 // Track the last second we beeped for countdown
};

let animationFrameId;
let audioCtx;

// --- DOM Elements ---
const timerDisplay = document.getElementById('timer-display');
const intervalDisplay = document.getElementById('interval-display');
const totalRing = document.getElementById('total-ring-fg');
const intervalRing = document.getElementById('interval-ring-fg');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const initOverlay = document.getElementById('init-overlay');
const initBtn = document.getElementById('init-btn');
const trophyOverlay = document.getElementById('trophy-overlay');

// Settings UI
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const totalDurationSelect = document.getElementById('total-duration-select');
const intervalDurationSelect = document.getElementById('interval-duration-select');

// --- Constants for SVG ---
const TOTAL_CIRCUMFERENCE = 2 * Math.PI * 40;
const INTERVAL_CIRCUMFERENCE = 2 * Math.PI * 70;

// --- Audio ---
// Simple synthesized bell sound
function playBell() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Bell-like parameters
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High A
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
}

function playEndSound() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Victory Fanfare: Rising C Major Arpeggio + Chord
    const now = audioCtx.currentTime;

    // Notes: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50];

    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'triangle'; // triangle sounds a bit more 'gamey'/'fun' than sine
        osc.frequency.value = freq;

        // Stagger starts: 0, 0.1, 0.2, 0.3
        const startTime = now + (i * 0.1);
        const duration = 0.8;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.start(startTime);
        osc.stop(startTime + duration);
    });

    // Final root chord hold for extra punch
    setTimeout(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'square'; // chiptune style punch
        osc.frequency.value = 523.25; // C5

        const finalStart = now + 0.4;
        gain.gain.setValueAtTime(0, finalStart);
        gain.gain.linearRampToValueAtTime(0.2, finalStart + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, finalStart + 1.5);

        osc.start(finalStart);
        osc.stop(finalStart + 1.5);
    }, 0);
}

function playCountdownBeep(frequency = 440) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    // Short pip
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

// --- Visual Effects ---
function triggerVictoryVisuals() {
    document.body.classList.add('victory');
    trophyOverlay.classList.add('show');
}

function clearVisuals() {
    document.body.classList.remove('victory');
    trophyOverlay.classList.remove('show');
}

// --- Logic ---

function updateDisplay() {
    // Calculate progress
    const totalElapsed = state.currentTotalElapsed;

    // Total Progress
    const totalProgress = calculateTotalProgress(totalElapsed, CONFIG.totalDurationSecs);
    const totalDashOffset = TOTAL_CIRCUMFERENCE * (1 - totalProgress);
    totalRing.style.strokeDashoffset = totalDashOffset;

    // Interval Progress
    const intervalProgress = calculateIntervalProgress(totalElapsed, CONFIG.intervalSecs);
    const intervalDashOffset = INTERVAL_CIRCUMFERENCE * (1 - intervalProgress);
    intervalRing.style.strokeDashoffset = intervalDashOffset;

    // Timer Text (Show remaining time in interval)
    // We want time elapsed within Current Interval
    const currentIntervalSec = totalElapsed % CONFIG.intervalSecs;
    const intervalTimerVal = Math.floor(currentIntervalSec);
    timerDisplay.textContent = formatTime(intervalTimerVal);

    // Rounds
    const { current, total } = getCurrentRound(totalElapsed, CONFIG.intervalSecs, CONFIG.totalDurationSecs);

    // If finished
    if (isFinished(totalElapsed, CONFIG.totalDurationSecs)) {
        intervalDisplay.textContent = "Done!";
        timerDisplay.textContent = formatTime(0); // or Duration?
        document.title = "Done! - EMOM Timer";
    } else {
        intervalDisplay.textContent = `Round ${current}/${total}`;
        document.title = `${formatTime(intervalTimerVal)} - EMOM Timer`;
    }
}

let lastIntervalIndex = -1;

function tick(timestamp) {
    if (!state.isRunning) return;

    if (!state.startTime) state.startTime = timestamp;

    const now = Date.now();
    const rawElapsed = (now - state.startTime) / 1000;

    state.currentTotalElapsed = rawElapsed;

    // --- Countdown Logic ---
    const beepCheck = getCountdownBeep(state.currentTotalElapsed, CONFIG.intervalSecs, state.lastBeepSecond);

    if (beepCheck.shouldBeep) {
        playCountdownBeep(beepCheck.freq);
        state.lastBeepSecond = beepCheck.newBeepId;
    }

    // Check for completion
    if (isFinished(state.currentTotalElapsed, CONFIG.totalDurationSecs)) {
        state.currentTotalElapsed = CONFIG.totalDurationSecs;
        pauseTimer();
        updateDisplay();
        // Play final sound & Visuals
        playEndSound();
        triggerVictoryVisuals();
        return;
    }

    // Check for interval bell (Round Start)
    const currentIntervalIndex = Math.floor(state.currentTotalElapsed / CONFIG.intervalSecs);
    if (currentIntervalIndex > lastIntervalIndex && currentIntervalIndex > 0) {
        playBell();
        lastIntervalIndex = currentIntervalIndex;
    }

    updateDisplay();

    animationFrameId = requestAnimationFrame(tick);
}

function startTimer() {
    if (state.isRunning) return;

    // Resume Audio Context if needed
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    state.isRunning = true;
    startBtn.innerText = "Pause";

    // Adjust start time to respect elapsed
    state.startTime = Date.now() - (state.currentTotalElapsed * 1000);

    if (state.currentTotalElapsed === 0) {
        lastIntervalIndex = 0;
        playBell();
        clearVisuals(); // Ensure clean start
    }

    tick();
}

// New Pre-Start Sequence
function startWithCountdown() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    clearVisuals(); // Clear any victory state
    startBtn.disabled = true;
    settingsToggle.style.pointerEvents = 'none'; // Lock settings

    let count = 3;
    timerDisplay.textContent = "READY";
    intervalDisplay.textContent = "Starting in " + count;

    playCountdownBeep(440); // 3 (Low)

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            intervalDisplay.textContent = "Starting in " + count;
            // Beep pitch up
            let freq = 440;
            if (count === 2) freq = 554;
            if (count === 1) freq = 659;
            playCountdownBeep(freq);
        } else {
            clearInterval(countdownInterval);
            startBtn.disabled = false;
            settingsToggle.style.pointerEvents = 'all';
            startTimer();
        }
    }, 1000);
}

function pauseTimer() {
    state.isRunning = false;
    startBtn.innerText = "Resume";
    cancelAnimationFrame(animationFrameId);
}

function resetTimer() {
    pauseTimer();
    state.currentTotalElapsed = 0;
    state.startTime = 0;
    lastIntervalIndex = -1;
    startBtn.innerText = "Start";
    updateDisplay();
    clearVisuals(); // Reset effects
}
function toggleTimer() {
    if (state.isRunning) {
        pauseTimer();
    } else {
        if (state.currentTotalElapsed >= CONFIG.totalDurationSecs) {
            resetTimer(); // Auto reset if finished
            startWithCountdown();
        } else if (state.currentTotalElapsed === 0) {
            // Start fresh -> Countdown
            startWithCountdown();
        } else {
            // Resume -> Immediate
            startTimer();
        }
    }
}

// --- Init ---
startBtn.addEventListener('click', toggleTimer);
resetBtn.addEventListener('click', resetTimer);

// Audio Context Init
initBtn.addEventListener('click', () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    initOverlay.style.display = 'none';
});

// Settings Logic
settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('visible');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.remove('visible');
    applySettings();
});

function applySettings() {
    // Only allow changing settings if timer is reset? 
    // Or allow dynamic? Dynamic is messy if mid-round.
    // Let's reset if settings change to keep logic simple.
    const newTotal = parseInt(totalDurationSelect.value);
    const newInterval = parseInt(intervalDurationSelect.value);

    if (newTotal !== CONFIG.totalDurationSecs || newInterval !== CONFIG.intervalSecs) {
        CONFIG.totalDurationSecs = newTotal;
        CONFIG.intervalSecs = newInterval;
        resetTimer(); // Enforce reset on config change
    }
}

// Initialize state
updateDisplay();
