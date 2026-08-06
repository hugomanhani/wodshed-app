// Drift-corrected timer — elapsed is always derived from real timestamps,
// so background-tab throttling never causes the displayed time to skew.

class WTimer {
  constructor({ mode = 'up', durationMs = 0, onTick, onComplete } = {}) {
    this.mode = mode;
    this.durationMs = durationMs;
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.accumulated = 0;
    this.runStartTs = null;
    this.running = false;
    this._interval = null;
    this._completed = false;
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
    if (durationMs != null) this.durationMs = durationMs;
  }

  destroy() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }

  _tick() {
    const val = this.mode === 'down' ? this.remainingMs() : this.elapsedMs();
    if (this.onTick) this.onTick(val);
    if (this.mode === 'down' && val <= 0 && !this._completed) {
      this._completed = true;
      this.pause();
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
