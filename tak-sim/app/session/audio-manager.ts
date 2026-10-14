import { Howl, Howler } from "howler";
import { assetUrl } from "./asset-url.js";

const BASE_VOLUME = 0.3;
const PEAK_VOLUME = 0.5; // Last 20 s of a view; was 0.8, too loud a rise (researcher, 9 Oct 2026)
const DRONE_VOLUME = 0.15; // Volume during SAGAT freezes

class AudioManager {
  private static instance: AudioManager;
  private bgm: Howl | null = null;
  private isMuted: boolean = false;
  private isTensionHigh: boolean = false;
  private freezeMode: boolean = false;
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    this.bgm = new Howl({
      src: [assetUrl("/audio/bgm_tension.mp3")],
      loop: true,
      volume: 0, 
      preload: true,
    });
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /** Starts the looping track with a fade-in. */
  public play(): void {
    if (this.isMuted || !this.bgm) return;
    
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }
    
    if (!this.bgm.playing()) {
      this.bgm.play();
      this.bgm.fade(0, this.getTargetVolume(), 2000);
    } else {
      // It is already playing, but might have been dynamically fading out
      this.bgm.fade(this.bgm.volume(), this.getTargetVolume(), 1000);
    }
  }

  /** Called periodically by the orchestrator mapping the `secondsLeft` to volume. */
  public setTensionBySeconds(secondsLeft: number | null): void {
    if (this.isMuted || !this.bgm || !this.bgm.playing() || this.freezeMode) return;
    
    // Ramp up starting at 20 seconds
    const tensionThreshold = 20;
    
    if (secondsLeft !== null && secondsLeft <= tensionThreshold && secondsLeft > 0) {
      if (!this.isTensionHigh) {
        this.isTensionHigh = true;
        this.bgm.fade(this.bgm.volume(), PEAK_VOLUME, 2000);
      }
    } else {
      if (this.isTensionHigh) {
        this.isTensionHigh = false;
        this.bgm.fade(this.bgm.volume(), BASE_VOLUME, 2000);
      }
    }
  }

  /** SAGAT freeze trigger: drop to a continuous low drone. */
  public enterFreeze(): void {
    this.freezeMode = true;
    if (this.bgm && this.bgm.playing() && !this.isMuted) {
      this.bgm.fade(this.bgm.volume(), DRONE_VOLUME, 500);
    }
  }

  /** SAGAT freeze exits: return to normal tension. */
  public exitFreeze(): void {
    this.freezeMode = false;
    if (this.bgm && this.bgm.playing() && !this.isMuted) {
      this.bgm.fade(this.bgm.volume(), this.getTargetVolume(), 1000);
    }
  }

  /** Fades out entirely when closing a view/session. */
  public stopAndFadeOut(): void {
    if (this.bgm && this.bgm.playing()) {
      this.bgm.fade(this.bgm.volume(), 0, 2000);
      if (this.fadeOutTimer) clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = setTimeout(() => {
        if (this.bgm) this.bgm.pause();
        this.fadeOutTimer = null;
      }, 2000);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      Howler.volume(0);
    } else {
      Howler.volume(1);
    }
    return this.isMuted;
  }

  public getMutedState(): boolean {
    return this.isMuted;
  }

  private getTargetVolume(): number {
    if (this.freezeMode) return DRONE_VOLUME;
    return this.isTensionHigh ? PEAK_VOLUME : BASE_VOLUME;
  }
}

export const audioManager = AudioManager.getInstance();
