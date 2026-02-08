export class AudioManager {
    private audioCtx: AudioContext | undefined;

    constructor() {
        // Lazy init
    }

    // Audio Context Init (Lazy load on user interaction)
    public ensureAudioContext(): void {
        if (!this.audioCtx) {
            // Check for window.webkitAudioContext if needed, though modern browsers use AudioContext
            const win = window as any;
            const AudioContextConstructor = win.AudioContext || win.webkitAudioContext;
            if (AudioContextConstructor) {
                this.audioCtx = new AudioContextConstructor();
            }
        } else if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    public playBell(): void {
        this.ensureAudioContext();
        if (!this.audioCtx) return;

        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        // Bell-like parameters
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // High A
        osc.frequency.exponentialRampToValueAtTime(440, this.audioCtx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.5);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 1.5);
    }

    public playCountdownBeep(frequency: number = 440): void {
        this.ensureAudioContext();
        if (!this.audioCtx) return;

        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

        // Short pip
        gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
    }

    public playEndSound(): void {
        this.ensureAudioContext();
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;

        // Victory Fanfare: Rising C Major Arpeggio + Chord
        const now = ctx.currentTime;

        // Notes: C5, E5, G5, C6
        const notes = [523.25, 659.25, 783.99, 1046.50];

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

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
            // Check if ctx is still valid
            if (ctx.state === 'closed') return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

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
}
