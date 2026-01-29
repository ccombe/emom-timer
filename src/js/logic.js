// Core logic functions (Pure, no DOM)

export function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export function calculateTotalProgress(elapsed, totalDuration) {
    if (totalDuration <= 0) return 1;
    return Math.min(elapsed / totalDuration, 1);
}

export function calculateIntervalProgress(elapsed, intervalDuration) {
    if (intervalDuration <= 0) return 0;
    const currentIntervalSec = elapsed % intervalDuration;
    return currentIntervalSec / intervalDuration;
}

export function getCurrentRound(elapsed, intervalDuration, totalDuration) {
    if (intervalDuration <= 0) return 0;
    const totalRounds = Math.floor(totalDuration / intervalDuration);
    let currentRound = Math.floor(elapsed / intervalDuration) + 1;
    if (currentRound > totalRounds) currentRound = totalRounds;
    return { current: currentRound, total: totalRounds };
}

export function isFinished(elapsed, totalDuration) {
    return elapsed >= totalDuration - 0.1;
}

export function getCountdownBeep(elapsed, intervalDuration, lastBeepId) {
    const currentIntervalElapsed = elapsed % intervalDuration;
    const currentIntervalRemaining = intervalDuration - currentIntervalElapsed;
    const secondsRemainingInt = Math.ceil(currentIntervalRemaining);

    // Logic: Beep at 3, 2, 1
    if (secondsRemainingInt <= 3 && secondsRemainingInt > 0) {
        // Prevent beep on very first start (elapsed 0) if necessary, 
        // but typically 0 elapsed means Duration remaining, so we are safe.
        // Needs a unique ID to prevent double triggers per second
        const currentRound = Math.floor(elapsed / intervalDuration);
        const beepId = `${currentRound}-${secondsRemainingInt}`;

        if (lastBeepId !== beepId) {
            let freq = 440;
            if (secondsRemainingInt === 2) freq = 554;
            if (secondsRemainingInt === 1) freq = 659;
            return { shouldBeep: true, freq, newBeepId: beepId };
        }
    }
    return { shouldBeep: false };
}
