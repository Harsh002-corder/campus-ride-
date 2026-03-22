let activeAudioContext: AudioContext | null = null;
let activeInterval: number | null = null;
let loopStopTimeout: number | null = null;

function ensureAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!activeAudioContext || activeAudioContext.state === "closed") {
    activeAudioContext = new AudioContextClass();
  }

  return activeAudioContext;
}

function playPulse(freq = 880, durationMs = 200, gainPeak = 0.08) {
  const context = ensureAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = freq;
  gainNode.gain.value = 0.0001;

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  const now = context.currentTime;
  const endAt = now + durationMs / 1000;

  gainNode.gain.exponentialRampToValueAtTime(gainPeak, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.start(now);
  oscillator.stop(endAt + 0.02);
}

export function playEventAlertTone() {
  playPulse(760, 180, 0.06);
}

export function playRideRequestLoop(durationMs = 10_000) {
  stopRideRequestLoop();

  playPulse(880, 220, 0.085);
  activeInterval = window.setInterval(() => {
    playPulse(880, 220, 0.085);
  }, 900);

  loopStopTimeout = window.setTimeout(() => {
    stopRideRequestLoop();
  }, Math.max(1200, durationMs));
}

export function stopRideRequestLoop() {
  if (activeInterval) {
    window.clearInterval(activeInterval);
    activeInterval = null;
  }

  if (loopStopTimeout) {
    window.clearTimeout(loopStopTimeout);
    loopStopTimeout = null;
  }
}
