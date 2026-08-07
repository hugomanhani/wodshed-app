// Drift-corrected timer — elapsed is always derived from real timestamps,
// so background-tab throttling never causes the displayed time to skew.

let __wodAudioCtx = null;
function ensureAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!__wodAudioCtx) __wodAudioCtx = new Ctx();
  if (__wodAudioCtx.state === 'suspended') __wodAudioCtx.resume();
  return __wodAudioCtx;
}

function playTone(freq, durationMs, delayMs = 0) {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.28, t0 + 0.01);
    gain.gain.linearRampToValueAtTime(0, t0 + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationMs / 1000 + 0.02);
  } catch (e) { /* audio unavailable, fail silently */ }
}

function playBeep(kind) {
  if (kind === 'tick') playTone(880, 110);
  else if (kind === 'final') { playTone(1175, 160); playTone(1175, 160, 200); }
}

class WTimer {
  constructor({ mode = 'up', durationMs = 0, onTick, onComplete, beep = true } = {}) {
    this.mode = mode;
    this.durationMs = durationMs;
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.beep = beep;
    this.accumulated = 0;
    this.runStartTs = null;
    this.running = false;
    this._interval = null;
    this._completed = false;
    this._lastBeepSec = null;
  }

  _now() { return performance.now(); }

  elapsedMs() {
    return this.accumulated + (this.running ? this._now() - this.runStartTs : 0);
  }

  remainingMs() {
    return Math.max(0, this.durationMs - this.elapsedMs());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.runStartTs = this._now();
    this._interval = setInterval(() => this._tick(), 200);
    this._tick();
  }

  pause() {
    if (!this.running) return;
    this.accumulated += this._now() - this.runStartTs;
    this.running = false;
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }

  toggle() { this.running ? this.pause() : this.start(); }

  reset(durationMs) {
    this.pause();
    this.accumulated = 0;
    this._completed = false;
    this._lastBeepSec = null;
    if (durationMs != null) this.durationMs = durationMs;
  }

  destroy() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }

  _tick() {
    const val = this.mode === 'down' ? this.remainingMs() : this.elapsedMs();
    if (this.onTick) this.onTick(val);
    if (this.mode === 'down' && this.beep && val > 0) {
      const wholeSec = Math.ceil(val / 1000);
      if (wholeSec !== this._lastBeepSec && wholeSec <= 3) {
        this._lastBeepSec = wholeSec;
        playBeep('tick');
      }
    }
    if (this.mode === 'down' && val <= 0 && !this._completed) {
      this._completed = true;
      this.pause();
      if (this.beep) playBeep('final');
      if (this.onComplete) this.onComplete();
    }
  }
}

function fmtClock(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
