import { ISpeechService, WebSpeechAdapter } from "./adapters.ts";

interface ScheduledTone {
  frequency: number;
  type: OscillatorType;
  startTime: number;
  attackTime: number;
  duration: number;
  peakGain: number;
}

export class AudioManager {
  private audioCtx: AudioContext | undefined;
  private readonly speechAdapter: ISpeechService;
  private silentOsc: OscillatorNode | undefined;

  constructor(speechAdapter?: ISpeechService) {
    this.speechAdapter = speechAdapter || new WebSpeechAdapter();
  }

  private pickAudioContextConstructor():
    | (new (contextOptions?: AudioContextOptions) => AudioContext)
    | undefined {
    const win = globalThis as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    return win.AudioContext ?? win.webkitAudioContext;
  }

  private createAudioContextIfNeeded(): void {
    const Ctor = this.pickAudioContextConstructor();
    if (Ctor) {
      this.audioCtx = new Ctor();
    }
  }

  // Audio Context Init (Lazy load on user interaction)
  public ensureAudioContext(): void {
    if (!this.audioCtx) {
      this.createAudioContextIfNeeded();
      return;
    }
    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }
  }

  private getAudioContext(): AudioContext | undefined {
    this.ensureAudioContext();
    return this.audioCtx;
  }

  private createOscillatorAndGain(): { osc: OscillatorNode; gainNode: GainNode; ctx: AudioContext } | null {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    return { osc, gainNode, ctx };
  }

  private scheduleTone(tone: ScheduledTone): void {
    const nodes = this.createOscillatorAndGain();
    if (!nodes) return;
    const { osc, gainNode } = nodes;
    const { frequency, type, startTime, attackTime, duration, peakGain } = tone;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attackTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
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
      } catch {
        // Oscillator may already be stopped; safe to ignore
      }
      this.silentOsc = undefined;
    }
  }

  public playCountdownBeep(frequency: number = 440): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.scheduleTone({
      frequency,
      type: "sine",
      startTime: ctx.currentTime,
      attackTime: 0,
      duration: 0.1,
      peakGain: 0.2,
    });
  }

  public playEndSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Victory Fanfare: Rising C Major Arpeggio + Chord
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const stagger = 0.1;
    const noteDuration = 0.8;

    notes.forEach((freq, i) => {
      this.scheduleTone({
        frequency: freq,
        type: "triangle",
        startTime: now + i * stagger,
        attackTime: 0.05,
        duration: noteDuration,
        peakGain: 0.3,
      });
    });

    // Final root chord hold for extra punch
    this.scheduleTone({
      frequency: 523.25,
      type: "square",
      startTime: now + 0.4,
      attackTime: 0.05,
      duration: 1.5,
      peakGain: 0.2,
    });
  }
}
