/**
 * Interfaces (Ports) defining our integration boundaries
 */
export interface ISpeechService {
  speak(text: string): void;
  cancel(): void;
}

export interface IMediaSessionOptions {
  title: string;
  artist: string;
  onPlay: () => void;
  onPause: () => void;
}

export interface IMediaSessionService {
  configure(options: IMediaSessionOptions): void;
  clear(): void;
}

/**
 * Concrete Adapters implementing the native browser capability.
 * This adheres to Hexagonal Architecture (Ports and Adapters),
 * allowing easy mocking for tests.
 */
export class WebSpeechAdapter implements ISpeechService {
  public speak(text: string): void {
    if (typeof globalThis === "undefined" || !("speechSynthesis" in globalThis)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    globalThis.speechSynthesis.speak(utterance);
  }
  public cancel(): void {
    if (typeof globalThis === "undefined" || !("speechSynthesis" in globalThis)) return;
    globalThis.speechSynthesis.cancel();
  }
}

export class MediaSessionAdapter implements IMediaSessionService {
  public configure(options: IMediaSessionOptions): void {
    if (typeof globalThis.navigator !== "undefined" && "mediaSession" in globalThis.navigator) {
      globalThis.navigator.mediaSession.metadata = new MediaMetadata({
        title: options.title,
        artist: options.artist,
      });
      globalThis.navigator.mediaSession.setActionHandler("play", options.onPlay);
      globalThis.navigator.mediaSession.setActionHandler("pause", options.onPause);
    }
  }

  public clear(): void {
    if (typeof globalThis.navigator !== "undefined" && "mediaSession" in globalThis.navigator) {
      globalThis.navigator.mediaSession.metadata = null;
      globalThis.navigator.mediaSession.setActionHandler("play", null);
      globalThis.navigator.mediaSession.setActionHandler("pause", null);
    }
  }
}
