/**
 * Bộ phát âm thanh & nhạc nền nhẹ cho máy Host (Web Audio API, không phụ thuộc file MP3 ngoài)
 * Có nút Bật/Tắt âm thanh trực tiếp trên màn hình Host (mục 4.1 & 11.2)
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  public muted = false;
  private bgInterval: ReturnType<typeof setInterval> | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopLobbyMusic();
    }
    return this.muted;
  }

  private playTone(freq: number, durationSec: number, type: OscillatorType = 'sine', gainVal = 0.12, delaySec = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const startTime = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainVal, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.02);
  }

  public playTick(urgent = false) {
    this.playTone(urgent ? 880 : 587.33, 0.09, 'triangle', urgent ? 0.14 : 0.08);
  }

  public playPlayerJoin() {
    this.playTone(523.25, 0.1, 'sine', 0.09, 0);
    this.playTone(659.25, 0.14, 'sine', 0.1, 0.08);
  }

  public playReveal() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.playTone(f, 0.22, 'triangle', 0.14, idx * 0.07);
    });
  }

  public playPodiumFanfare() {
    const chord = [
      { f: 523.25, d: 0.18, t: 0 },
      { f: 659.25, d: 0.18, t: 0.15 },
      { f: 783.99, d: 0.18, t: 0.3 },
      { f: 1046.5, d: 0.55, t: 0.45 }
    ];
    for (const n of chord) {
      this.playTone(n.f, n.d, 'triangle', 0.16, n.t);
    }
  }

  public startLobbyMusic() {
    this.stopLobbyMusic();
    if (this.muted) return;
    const melody = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63];
    let step = 0;
    this.bgInterval = setInterval(() => {
      if (this.muted) return;
      const freq = melody[step % melody.length];
      this.playTone(freq, 0.45, 'sine', 0.04);
      step++;
    }, 650);
  }

  public stopLobbyMusic() {
    if (this.bgInterval) {
      clearInterval(this.bgInterval);
      this.bgInterval = null;
    }
  }
}

export const soundManager = new SoundManager();

