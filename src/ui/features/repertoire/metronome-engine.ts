export const METRONOME_MIN_BPM = 40;
export const METRONOME_MAX_BPM = 208;

export const METRONOME_BEATS_OPTIONS = [2, 3, 4, 6] as const;
export type MetronomeBeatsPerMeasure = (typeof METRONOME_BEATS_OPTIONS)[number];

export type MetronomeEngineOptions = {
  bpm: number;
  beatsPerMeasure: MetronomeBeatsPerMeasure;
  volume: number;
  onBeat?: (beatIndex: number) => void;
};

const SCHEDULE_AHEAD_SEC = 0.1;
const SCHEDULE_INTERVAL_MS = 20;
const ACCENT_FREQUENCY_HZ = 1200;
const NORMAL_FREQUENCY_HZ = 1000;
const CLICK_DURATION_SEC = 0.05;
const ACCENT_GAIN_RATIO = 0.5;
const NORMAL_GAIN_RATIO = 0.4;

export function clampMetronomeBpm(bpm: number): number {
  return Math.min(METRONOME_MAX_BPM, Math.max(METRONOME_MIN_BPM, Math.round(bpm)));
}

export function metronomeBeatIntervalSec(bpm: number): number {
  return 60 / clampMetronomeBpm(bpm);
}

export function normalizeBeatsPerMeasure(value: number): MetronomeBeatsPerMeasure {
  if (METRONOME_BEATS_OPTIONS.includes(value as MetronomeBeatsPerMeasure)) {
    return value as MetronomeBeatsPerMeasure;
  }
  return 4;
}

export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private running = false;

  private bpm: number;
  private beatsPerMeasure: MetronomeBeatsPerMeasure;
  private volume: number;
  private onBeat?: (beatIndex: number) => void;

  constructor(options: MetronomeEngineOptions) {
    this.bpm = clampMetronomeBpm(options.bpm);
    this.beatsPerMeasure = normalizeBeatsPerMeasure(options.beatsPerMeasure);
    this.volume = options.volume;
    this.onBeat = options.onBeat;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentBeatIndex(): number {
    return this.beatIndex % this.beatsPerMeasure;
  }

  setBpm(bpm: number): void {
    this.bpm = clampMetronomeBpm(bpm);
  }

  setBeatsPerMeasure(beatsPerMeasure: number): void {
    this.beatsPerMeasure = normalizeBeatsPerMeasure(beatsPerMeasure);
    this.beatIndex = 0;
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
  }

  setOnBeat(onBeat: ((beatIndex: number) => void) | undefined): void {
    this.onBeat = onBeat;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.running = true;
    this.beatIndex = 0;
    this.nextBeatTime = this.ctx.currentTime + 0.05;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  private schedule(): void {
    if (!this.running || !this.ctx) {
      return;
    }

    const interval = metronomeBeatIntervalSec(this.bpm);

    while (this.nextBeatTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const beatInMeasure = this.beatIndex % this.beatsPerMeasure;
      this.playClick(this.nextBeatTime, beatInMeasure === 0);
      this.onBeat?.(beatInMeasure);
      this.nextBeatTime += interval;
      this.beatIndex += 1;
    }

    this.timerId = setTimeout(() => this.schedule(), SCHEDULE_INTERVAL_MS);
  }

  private playClick(time: number, accent: boolean): void {
    if (!this.ctx) {
      return;
    }

    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = accent ? ACCENT_FREQUENCY_HZ : NORMAL_FREQUENCY_HZ;

    const peakGain = accent ? this.volume * ACCENT_GAIN_RATIO : this.volume * NORMAL_GAIN_RATIO;
    gain.gain.setValueAtTime(peakGain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION_SEC);

    oscillator.connect(gain);
    gain.connect(this.ctx.destination);
    oscillator.start(time);
    oscillator.stop(time + CLICK_DURATION_SEC);
  }
}
