const BEEP_HZ = 880;
const BEEP_DURATION_SEC = 0.28;
const BEEP_GAP_SEC = 0.12;
const BEEP_COUNT = 3;
const BEEP_GAIN = 0.45;

export async function playStudyTimerCompleteSound(): Promise<void> {
  if (typeof AudioContext === 'undefined') {
    return;
  }

  const ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const start = ctx.currentTime + 0.05;

  for (let index = 0; index < BEEP_COUNT; index += 1) {
    const time = start + index * (BEEP_DURATION_SEC + BEEP_GAP_SEC);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = BEEP_HZ;
    gain.gain.setValueAtTime(BEEP_GAIN, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + BEEP_DURATION_SEC);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(time);
    oscillator.stop(time + BEEP_DURATION_SEC);
  }

  window.setTimeout(() => {
    void ctx.close();
  }, (BEEP_COUNT * (BEEP_DURATION_SEC + BEEP_GAP_SEC) + 0.2) * 1000);
}
