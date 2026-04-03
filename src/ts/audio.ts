import { ISpeechService, WebSpeechAdapter } from "./adapters.ts";

export class AudioManager {
  private audioCtx: AudioContext | undefined;
  private readonly speechAdapter: ISpeechService;
  private silentOsc: OscillatorNode | undefined;

  constructor(speechAdapter?: ISpeechService) {
    this.speechAdapter = speechAdapter || new WebSpeechAdapter();
  }

  // Audio Context Init (Lazy load on user interaction)
  public ensureAudioContext(): void {
    if (!this.audioCtx) {
      // Check for window.webkitAudioContext if needed, though modern browsers use AudioContext
      const win = globalThis as any;
      const AudioContextConstructor = win.AudioContext || win.webkitAudioContext;
      if (AudioContextConstructor) {
        this.audioCtx = new AudioContextConstructor();
      }
    } else if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  private createOscillatorAndGain(): { osc: OscillatorNode; gainNode: GainNode; ctx: AudioContext } | null {
    this.ensureAudioContext();
    if (!this.audioCtx) return null;

    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    return { osc, gainNode, ctx: this.audioCtx };
  }

  public playBell(): void {
    const nodes = this.createOscillatorAndGain();
    if (!nodes) return;
    const { osc, gainNode, ctx } = nodes;

    // Bell-like parameters
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // High A
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  }

  public announcePhase(text: string): void {
    this.speechAdapter.cancel();
    this.speechAdapter.speak(text);
  }

  public maintainLockScreenAudio(): void {
    if (this.silentOsc) return;

    const nodes = this.createOscillatorAndGain();
    if (!nodes) return;
    
    this.silentOsc = nodes.osc;
    const gainNode = nodes.gainNode;
    gainNode.gain.value = 0; // Absolute silence
    
    this.silentOsc.start();
  }

  public releaseLockScreenAudio(): void {
    if (this.silentOsc) {
      try {
        this.silentOsc.stop();
        this.silentOsc.disconnect();
      } catch (e: unknown) {
        console.warn("Failed to stop silent oscillator", e);
      }
      this.silentOsc = undefined;
    }
  }

  public playCountdownBeep(frequency: number = 440): void {
    const nodes = this.createOscillatorAndGain();
    if (!nodes) return;
    const { osc, gainNode, ctx } = nodes;

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Short pip
    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  public playEndSound(): void {
    this.ensureAudioContext();
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;

    // Victory Fanfare: Rising C Major Arpeggio + Chord
    const now = ctx.currentTime;

    // Notes: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, i) => {
      const nodes = this.createOscillatorAndGain();
      if (!nodes) return;
      const { osc, gainNode } = nodes;

      osc.type = "triangle"; // triangle sounds a bit more 'gamey'/'fun' than sine
      osc.frequency.value = freq;

      // Stagger starts: 0, 0.1, 0.2, 0.3
      const startTime = now + i * 0.1;
      const duration = 0.8;

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });

    // Final root chord hold for extra punch
    setTimeout(() => {
      // Check if ctx is still valid
      if (ctx.state === "closed") return;

      const nodes = this.createOscillatorAndGain();
      if (!nodes) return;
      const { osc, gainNode } = nodes;

      osc.type = "square"; // chiptune style punch
      osc.frequency.value = 523.25; // C5

      const finalStart = now + 0.4;
      gainNode.gain.setValueAtTime(0, finalStart);
      gainNode.gain.linearRampToValueAtTime(0.2, finalStart + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, finalStart + 1.5);

      osc.start(finalStart);
      osc.stop(finalStart + 1.5);
    }, 0);
  }
}
