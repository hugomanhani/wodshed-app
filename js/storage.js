// WODshed storage — single localStorage blob, versioned.

const STORAGE_KEY = 'wodshed_v1';

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function daysBetween(iso1, iso2) {
  const a = new Date(iso1 + 'T00:00:00');
  const b = new Date(iso2 + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function defaultState() {
  return {
    version: 1,
    onboarded: false,
    equipment: [],
    focusHistory: {},      // focus -> lastTrainedISO
    contentLRU: {},        // templateId/exerciseId -> lastUsedISO
    lifts: {},              // exerciseId -> { history: [{date, weight, reps, rating}], startWeight }
    volumeMultiplier: { strength: 1.0, gymnastics: 1.0, weightlifting: 1.0, accessory: 1.0, conditioning: 1.0 },
    benchmarks: {},         // benchmarkId -> { lastTested: ISO, results: [{date, result}] }
    sessionLog: [],         // completed days
    conditioningStreak: 0,  // sessions since last benchmark, for cadence suggestion
    today: null,            // cached generated plan for the current date
    lastPatternIndex: {},   // focus -> index into rotation pointer (deliberate sub-focus rotation)
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed);
  } catch (e) {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const Store = {
  state: loadState(),
  save() { saveState(this.state); },
  reset() { this.state = defaultState(); this.save(); },
};
