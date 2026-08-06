// WODshed UI controller — plain-JS, full-screen re-render per state change.
// Timer onTick callbacks always re-query the DOM by id, so a re-render never
// breaks an in-flight timer.

const ICON = {
  back: '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="10,3 5,8 10,13"/></svg>',
  play: '<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><polygon points="3,2 14,8 3,14"/></svg>',
  pause: '<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12"/><rect x="9" y="2" width="4" height="12"/></svg>',
  check: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="3,8 6,11 13,4"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6,3 11,8 6,13"/></svg>',
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/></svg>',
  history: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19.7a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4.3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10.5a1.7 1.7 0 0 0 1-1.55V4.3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10.5a1.7 1.7 0 0 0 1.55 1H19.7a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></svg>',
};

const SECTION_TITLES = { warmup: 'Warm-Up', skill: 'Skill', wod: 'WOD', core: 'Extra Core' };
const RATING_LABEL = { easy: 'Easy', right: 'Right', hard: 'Hard' };
const RATING_TAG_CLASS = { easy: 'tag-good', right: 'tag-neutral', hard: 'tag-warn' };

const UI = {
  screen: 'boot', tab: 'today', execSection: null, timer: null, dialog: null,
  warmupChecks: [], skillSetIndex: 0, skillWeight: 0, skillResting: false, skillRoundIndex: 1,
  bRoundIndex: 1, wodElapsed: 0, wodStepIndex: 0, wodRftRound: 0, wodAmrapRounds: 0, wodAmrapReps: 0,
  coreRound: 1, corePhase: 'work', coreChecks: [], pendingResult: null, running: false,
};

function app() { return document.getElementById('app'); }
function esc(s) { return String(s); }
function byId(id) { return document.getElementById(id); }

function render() {
  const root = app();
  let html = '';
  if (UI.screen === 'onboarding') html = renderOnboarding();
  else if (UI.screen === 'today') html = renderShell(renderToday(), 'today');
  else if (UI.screen === 'exec') html = renderExecScreen();
  else if (UI.screen === 'rating') html = renderRating();
  else if (UI.screen === 'summary') html = renderSummary();
  else if (UI.screen === 'history') html = renderShell(renderHistory(), 'history');
  else if (UI.screen === 'equipment') html = renderShell(renderEquipmentTab(), 'equipment');

  if (UI.dialog) html += renderDialog();
  root.innerHTML = html;
}

function renderShell(innerHtml, activeTab) {
  return `<div class="screen">${innerHtml}</div>${renderBottomNav(activeTab)}`;
}

function renderBottomNav(active) {
  const item = (key, icon, label) => `<button class="nav-item ${active === key ? 'active' : ''}" onclick="App.goTab('${key}')">${icon}<span>${label}</span></button>`;
  return `<div class="bottomnav">${item('today', ICON.home, 'Today')}${item('history', ICON.history, 'History')}${item('equipment', ICON.gear, 'Equipment')}</div>`;
}

function infoBtn(key) { return `<button class="info-btn" onclick="App.showInfo('${key}')">i</button>`; }

function renderDialog() {
  const g = GLOSSARY[UI.dialog];
  const title = UI.dialog.charAt(0) + UI.dialog.slice(1).toLowerCase();
  return `<div class="dialog-backdrop" onclick="App.closeDialog()">
    <div class="dialog" onclick="event.stopPropagation()">
      <div class="dialog-title">${title}</div>
      <div class="dialog-body">${g || ''}</div>
      <button class="btn btn-primary btn-block" onclick="App.closeDialog()">Got it</button>
    </div>
  </div>`;
}

// ─── Onboarding / Equipment picker ─────────────────────────────────────────

function equipmentPickerHtml() {
  const equip = Store.state.equipment;
  const presetChips = Object.keys(EQUIPMENT_PRESETS).map(key => {
    const p = EQUIPMENT_PRESETS[key];
    const isActive = sameSet(equip, p.items);
    return `<div class="preset-chip ${isActive ? 'active' : ''}" onclick="App.applyPreset('${key}')">${p.label}</div>`;
  }).join('');

  const groups = EQUIPMENT_GROUPS.map(g => {
    const rows = g.items.map(it => {
      const on = equip.includes(it.id);
      return `<div class="equip-toggle" onclick="App.toggleEquip('${it.id}')">
        <span>${it.label}</span><div class="switch ${on ? 'on' : ''}"></div>
      </div>`;
    }).join('');
    return `<div class="equip-group"><div class="equip-group-label">${g.label}</div>${rows}</div>`;
  }).join('');

  return `<div class="preset-row">${presetChips}</div>${groups}`;
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort(), sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function renderOnboarding() {
  return `<div class="onboard-wrap">
    <div class="onboard-header">
      <h1>Welcome to WODshed</h1>
      <p class="section-sub" style="padding:0;margin-top:8px">Tell us what you've got. Toggle individual items, or start from a preset — you can change this anytime.</p>
    </div>
    <div class="scroll-content">${equipmentPickerHtml()}</div>
    <div class="onboard-footer">
      <button class="btn btn-primary btn-block" onclick="App.finishOnboarding()">Continue</button>
    </div>
  </div>`;
}

function renderEquipmentTab() {
  return `<div class="section-heading">Equipment</div>
  <div class="section-sub">Changes apply to your next generated day.</div>
  ${equipmentPickerHtml()}
  <div style="padding:var(--space-4)">
    <button class="btn btn-danger btn-block" onclick="App.confirmReset()">Reset All Data</button>
  </div>`;
}

// ─── Today screen ───────────────────────────────────────────────────────────

function renderToday() {
  const plan = Store.state.today;
  const order = ['warmup', 'skill', 'wod', 'core'];
  const doneCount = order.filter(s => plan.completed[s]).length;
  const startLabel = doneCount === 0 ? 'Start Workout' : (doneCount === 4 ? 'Workout Done' : 'Resume Workout');
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const segs = order.map(s => `<div class="progress-seg ${plan.completed[s] ? 'done' : ''}"></div>`).join('');

  const cards = order.map(s => sectionCardHtml(s, plan)).join('');

  let banner = '';
  if (plan.benchmarkOffer && !plan.isBenchmark && !plan.completed.wod) {
    const b = BENCHMARKS.find(x => x.id === plan.benchmarkOffer);
    banner = `<div class="banner">
      <div class="banner-title">Ready for a milestone? ${infoBtn('BENCHMARK')}</div>
      <div class="banner-sub">Swap today's WOD for ${b.name} — ${b.line}</div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-secondary" style="flex:1" onclick="App.dismissBenchmark()">Not today</button>
        <button class="btn btn-primary" style="flex:1" onclick="App.acceptBenchmark()">Test ${b.name}</button>
      </div>
    </div>`;
  }

  return `
    <div class="topbar">
      <div>
        <div class="date-label">${dateStr}</div>
        <h1>Today</h1>
      </div>
      <span class="tag tag-accent">${FOCUS_LABELS[plan.focus].toUpperCase()} FOCUS</span>
    </div>
    <div class="progress-row">${segs}</div>
    <div style="padding:0 var(--space-4) var(--space-4)">
      <button class="btn btn-primary btn-block" ${doneCount === 4 ? 'disabled' : ''} onclick="App.startOrResume()">
        ${doneCount < 4 ? ICON.play : ''} ${startLabel}
      </button>
    </div>
    ${banner}
    <div class="card-list">${cards}</div>
    <div style="height:24px"></div>
  `;
}

function sectionCardHtml(section, plan) {
  const done = plan.completed[section];
  const rating = plan.ratings[section];
  let title, meta;
  if (section === 'warmup') { title = 'Warm-Up'; meta = `2 Rounds · ${plan.warmup.moves.map(m => exerciseById(m).name).join(', ')}`; }
  else if (section === 'skill') {
    title = 'Skill' + (plan.skill.liftName ? ' · ' + plan.skill.liftName : '');
    meta = skillMetaLine(plan.skill);
  } else if (section === 'wod') {
    title = 'WOD · ' + (plan.isBenchmark ? plan.benchmarkName : plan.wod.label);
    meta = `${plan.wod.badge} · ${plan.wod.movements}`;
  } else { title = 'Extra Core'; meta = coreMetaLine(plan.core); }

  const icon = done ? ICON.check : ICON.play;
  const iconCls = done ? 'section-icon done' : 'section-icon';
  const right = done
    ? `<span class="tag ${RATING_TAG_CLASS[rating]}">${RATING_LABEL[rating]}</span>`
    : ICON.chev;

  return `<div class="section-card ${done ? 'disabled' : ''}" onclick="${done ? '' : `App.enterExec('${section}')`}">
    <div class="${iconCls}">${icon}</div>
    <div class="section-body">
      <div class="section-title">${title}</div>
      <div class="section-meta">${meta}</div>
    </div>
    <div class="chev">${right}</div>
  </div>`;
}

function skillMetaLine(skill) {
  if (skill.shape === 'A') return `${skill.scheme.length} Sets · ${skill.scheme.join('-')}`;
  if (skill.shape === 'B') return `EMOM ${skill.rounds}' · ${skill.oddName} / ${skill.evenName}`;
  return `${skill.rounds} Rounds · ${skill.moveNames.join(', ')}`;
}
function coreMetaLine(core) {
  if (core.shape === 'tabata') return `Tabata · ${core.rounds} Rounds · ${core.moves.map(m => exerciseById(m).name).join(' / ')}`;
  if (core.shape === 'holds') return `${core.rounds} Rounds · ${core.moves.map(m => exerciseById(m).name).join(' / ')} Hold`;
  return `${core.rounds} Rounds · ${core.moves.map(m => exerciseById(m).name).join(', ')}`;
}

// ─── Execution screens ───────────────────────────────────────────────────

function execHeader(title, infoKey) {
  return `<div class="exec-header">
    <button class="btn btn-icon btn-ghost" onclick="App.exitExec()">${ICON.back}</button>
    <div class="kicker">${title}${infoKey ? infoBtn(infoKey) : ''}</div>
    <div style="width:44px"></div>
  </div>`;
}

function playPauseBtn(big) {
  const size = big ? 'width:64px;height:64px' : 'width:52px;height:52px';
  return `<button class="btn btn-primary btn-icon" style="${size}" onclick="App.toggleTimer()">${UI.running ? ICON.pause : ICON.play}</button>`;
}

function renderExecScreen() {
  const plan = Store.state.today;
  const section = UI.execSection;
  const title = SECTION_TITLES[section].toUpperCase();

  if (section === 'warmup') return `<div class="screen no-nav">${execHeader(title)}${renderWarmupBody(plan.warmup)}</div>`;
  if (section === 'skill') return `<div class="screen no-nav">${execHeader(title)}${renderSkillBody(plan.skill)}</div>`;
  if (section === 'wod') {
    const fmtKey = plan.wod.format.toUpperCase() === 'FORTIME' ? 'FORTIME' : plan.wod.format.toUpperCase();
    return `<div class="screen no-nav">${execHeader(title, fmtKey)}${renderWodBody(plan.wod, plan)}</div>`;
  }
  if (section === 'core') return `<div class="screen no-nav">${execHeader(title)}${renderCoreBody(plan.core)}</div>`;
  return '';
}

function renderWarmupBody(warmup) {
  const items = UI.warmupChecks.map((c, i) => {
    const moveId = warmup.moves[i % warmup.moves.length];
    const round = Math.floor(i / warmup.moves.length) + 1;
    return `<div class="check-item" onclick="App.toggleWarmupCheck(${i})">
      <div class="check-box ${c ? 'checked' : ''}">${c ? ICON.check : ''}</div>
      <div class="check-label ${c ? 'checked' : ''}">${exerciseById(moveId).name}</div>
      <div class="check-round">R${round}</div>
    </div>`;
  }).join('');

  return `<div class="exec-body">
    <div class="big-time" id="warmupTime">${fmtClock(UI.timer ? UI.timer.elapsedMs() : 0)}</div>
    ${playPauseBtn(true)}
    <div class="checklist">${items}</div>
    <button class="btn btn-primary btn-block" style="margin-top:auto" onclick="App.finishWarmup()">Finish Warm-Up</button>
  </div>`;
}

function renderSkillBody(skill) {
  if (skill.shape === 'A') {
    const reps = skill.scheme[UI.skillSetIndex];
    const isLast = UI.skillSetIndex + 1 >= skill.scheme.length;
    const rest = UI.skillResting ? `<div class="card" style="width:100%;align-items:center;gap:8px;display:flex;flex-direction:column">
        <div class="time-label">Rest</div>
        <div class="mid-time" id="restTime">${fmtClock(UI.timer ? UI.timer.remainingMs() : 0)}</div>
        <button class="btn btn-ghost" onclick="App.skipRest()">Skip Rest</button>
      </div>` : '';
    return `<div class="exec-body">
      <div class="time-label">${skill.liftName}</div>
      <div class="section-meta">SET ${UI.skillSetIndex + 1} / ${skill.scheme.length}</div>
      <div class="big-time">${reps}<span style="font-size:18px;color:var(--color-neutral-500)"> reps</span></div>
      <div class="weight-row">
        <button class="stepper-btn" onclick="App.adjustWeight(-1)">−</button>
        <div class="weight-value">${UI.skillWeight}<span class="unit"> lb</span></div>
        <button class="stepper-btn" onclick="App.adjustWeight(1)">+</button>
      </div>
      ${rest}
      <button class="btn btn-primary btn-block" style="margin-top:auto" ${UI.skillResting ? 'disabled' : ''} onclick="App.completeSet()">${isLast ? 'Finish Skill' : 'Complete Set'}</button>
    </div>`;
  }

  if (skill.shape === 'B') {
    const isOdd = UI.bRoundIndex % 2 === 1;
    const moveName = isOdd ? skill.oddName : skill.evenName;
    const desc = skill.secHold ? `${skill.secHold}s Hold` : `${skill.reps} Reps`;
    return `<div class="exec-body">
      <div class="time-label">MIN ${UI.bRoundIndex} / ${skill.rounds}</div>
      <div class="section-meta">${isOdd ? 'ODD' : 'EVEN'}: ${desc} ${moveName}</div>
      <div class="big-time" id="bTime">${fmtClock(UI.timer ? UI.timer.remainingMs() : 0)}</div>
      ${playPauseBtn(true)}
      <button class="btn btn-ghost" style="margin-top:auto" onclick="App.skillSkipRound()">Skip to Next Minute</button>
    </div>`;
  }

  // shape C
  const moves = skill.moveNames.map(n => `<div class="move-line">${skill.reps} ${n}</div>`).join('');
  const rest = UI.skillResting ? `<div class="card" style="width:100%;align-items:center;gap:8px;display:flex;flex-direction:column">
      <div class="time-label">Rest</div>
      <div class="mid-time" id="restTime">${fmtClock(UI.timer ? UI.timer.remainingMs() : 0)}</div>
      <button class="btn btn-ghost" onclick="App.skipRest()">Skip Rest</button>
    </div>` : '';
  const isLast = UI.skillRoundIndex >= skill.rounds;
  return `<div class="exec-body">
    <div class="section-meta">ROUND ${UI.skillRoundIndex} / ${skill.rounds}</div>
    <div class="move-list">${moves}</div>
    ${rest}
    <button class="btn btn-primary btn-block" style="margin-top:auto" ${UI.skillResting ? 'disabled' : ''} onclick="App.completeSkillRound()">${isLast ? 'Finish Skill' : 'Complete Round'}</button>
  </div>`;
}

function capTagHtml(elapsedMs, capSec) {
  if (!capSec) return '';
  return elapsedMs / 1000 >= capSec ? `<span class="tag tag-warn">TIME CAP</span>` : '';
}

function renderWodBody(wod, plan) {
  if (wod.format === 'ladder') {
    const step = wod.steps[UI.wodStepIndex];
    const isLast = UI.wodStepIndex + 1 >= wod.steps.length;
    return `<div class="exec-body">
      <div class="card" style="width:100%"><div style="font-size:13px;color:var(--color-neutral-400)">${wod.movements}</div></div>
      <div class="section-meta">ROUND ${UI.wodStepIndex + 1} / ${wod.steps.length} · ${wod.steps.join('–')}</div>
      <div class="big-time">${step}</div>
      <div class="mid-time" id="wodTime" style="color:var(--color-neutral-400)">${fmtClock(UI.timer ? UI.timer.elapsedMs() : 0)}</div>
      ${capTagHtml(UI.timer ? UI.timer.elapsedMs() : 0, wod.capSec)}
      <div class="action-row">
        ${playPauseBtn(false)}
        <button class="btn btn-primary" style="flex:1" onclick="App.wodRoundDone()">${isLast ? 'Finish WOD' : 'Round Done'}</button>
      </div>
    </div>`;
  }
  if (wod.format === 'rft') {
    const isLast = UI.wodRftRound + 1 >= wod.rounds;
    return `<div class="exec-body">
      <div class="card" style="width:100%"><div style="font-size:13px;color:var(--color-neutral-400)">${wod.movements}</div></div>
      <div class="section-meta">ROUND ${UI.wodRftRound + 1} / ${wod.rounds}</div>
      <div class="mid-time" id="wodTime">${fmtClock(UI.timer ? UI.timer.elapsedMs() : 0)}</div>
      ${capTagHtml(UI.timer ? UI.timer.elapsedMs() : 0, wod.capSec)}
      <div class="action-row">
        ${playPauseBtn(false)}
        <button class="btn btn-primary" style="flex:1" onclick="App.wodRoundDone()">${isLast ? 'Finish WOD' : 'Round Done'}</button>
      </div>
    </div>`;
  }
  if (wod.format === 'fortime') {
    return `<div class="exec-body">
      <div class="card" style="width:100%"><div style="font-size:13px;color:var(--color-neutral-400)">${wod.movements}</div></div>
      <div class="mid-time" id="wodTime">${fmtClock(UI.timer ? UI.timer.elapsedMs() : 0)}</div>
      ${capTagHtml(UI.timer ? UI.timer.elapsedMs() : 0, wod.capSec)}
      <div class="action-row">
        ${playPauseBtn(false)}
        <button class="btn btn-primary" style="flex:1" onclick="App.finishFortime()">Finish</button>
      </div>
    </div>`;
  }
  if (wod.format === 'amrap') {
    return `<div class="exec-body">
      <div class="card" style="width:100%"><div style="font-size:13px;color:var(--color-neutral-400)">${wod.movements}</div></div>
      <div class="big-time" id="wodTime">${fmtClock(UI.timer ? UI.timer.remainingMs() : 0)}</div>
      <div class="stepper-row">
        <div class="stepper">
          <div class="stepper-label">Rounds</div>
          <button class="stepper-val" style="border:none;font-size:20px" onclick="App.amrapAddRound()">${UI.wodAmrapRounds}</button>
        </div>
        <div class="stepper">
          <div class="stepper-label">+ Reps</div>
          <div class="stepper-controls">
            <button class="stepper-btn" onclick="App.amrapAddRep(-1)">−</button>
            <div class="stepper-val">${UI.wodAmrapReps}</div>
            <button class="stepper-btn" onclick="App.amrapAddRep(1)">+</button>
          </div>
        </div>
      </div>
      <div style="margin-top:auto;display:flex;gap:12px;align-items:center">
        ${playPauseBtn(true)}
        <button class="btn btn-ghost" onclick="App.finishAmrap()">Finish Early</button>
      </div>
    </div>`;
  }
  // emom
  const isOdd = UI.bRoundIndex % 2 === 1;
  const line = plan.isBenchmark ? wod.movements : (isOdd ? wod.oddLine : wod.evenLine);
  const isLastRound = UI.bRoundIndex >= wod.rounds;
  return `<div class="exec-body">
    <div class="time-label">MIN ${UI.bRoundIndex} / ${wod.rounds}</div>
    <div class="section-meta" style="text-align:center">${line}</div>
    <div class="big-time" id="bTime">${fmtClock(UI.timer ? UI.timer.remainingMs() : 0)}</div>
    ${playPauseBtn(true)}
    <button class="btn btn-ghost" style="margin-top:auto" onclick="App.wodSkipRound()">${isLastRound ? 'Finish WOD' : 'Skip to Next Minute'}</button>
  </div>`;
}

function renderCoreBody(core) {
  if (core.shape === 'tabata' || core.shape === 'holds') {
    const moveName = exerciseById(core.moves[(UI.coreRound - 1) % core.moves.length]).name;
    const phaseLabel = UI.corePhase === 'work' || UI.corePhase === 'hold' ? (core.shape === 'tabata' ? 'WORK' : 'HOLD') : 'REST';
    return `<div class="exec-body" style="justify-content:center">
      <span class="tag ${UI.corePhase === 'rest' ? 'tag-neutral' : 'tag-accent'}">${phaseLabel}</span>
      <div class="section-meta">${moveName}</div>
      <div class="big-time" style="font-size:88px" id="coreTime">${Math.ceil((UI.timer ? UI.timer.remainingMs() : 0) / 1000)}</div>
      <div class="time-label">ROUND ${UI.coreRound} / ${core.rounds}</div>
      ${playPauseBtn(true)}
    </div>`;
  }
  // straight
  const items = UI.coreChecks.map((c, i) => {
    const moveId = core.moves[i % core.moves.length];
    const round = Math.floor(i / core.moves.length) + 1;
    return `<div class="check-item" onclick="App.toggleCoreCheck(${i})">
      <div class="check-box ${c ? 'checked' : ''}">${c ? ICON.check : ''}</div>
      <div class="check-label ${c ? 'checked' : ''}">${core.reps} ${exerciseById(moveId).name}</div>
      <div class="check-round">R${round}</div>
    </div>`;
  }).join('');
  return `<div class="exec-body">
    <div class="big-time" id="coreTimeUp">${fmtClock(UI.timer ? UI.timer.elapsedMs() : 0)}</div>
    ${playPauseBtn(true)}
    <div class="checklist">${items}</div>
    <button class="btn btn-primary btn-block" style="margin-top:auto" onclick="App.finishCore()">Finish Extra Core</button>
  </div>`;
}

// ─── Rating / Summary ───────────────────────────────────────────────────────

function renderRating() {
  return `<div class="screen no-nav">
    <div class="rating-screen">
      <span class="tag tag-neutral">${SECTION_TITLES[UI.execSection].toUpperCase()} COMPLETE</span>
      <h3>How did that feel?</h3>
      <div class="rating-buttons">
        <button class="btn btn-secondary btn-block" onclick="App.rate('easy')">Easy</button>
        <button class="btn btn-primary btn-block" onclick="App.rate('right')">Right</button>
        <button class="btn btn-secondary btn-block" onclick="App.rate('hard')">Hard</button>
      </div>
    </div>
  </div>`;
}

function renderSummary() {
  const plan = Store.state.today;
  const order = ['warmup', 'skill', 'wod', 'core'];
  const rows = order.map(s => `<div class="card" style="flex-direction:row;justify-content:space-between;align-items:center;display:flex">
    <div class="section-title" style="font-size:15px">${SECTION_TITLES[s]}</div>
    <span class="tag ${RATING_TAG_CLASS[plan.ratings[s]]}">${RATING_LABEL[plan.ratings[s]]}</span>
  </div>`).join('');
  return `<div class="screen no-nav">
    <div class="exec-body" style="padding-top:var(--space-8)">
      <h2>Workout Complete</h2>
      <div class="move-list">${rows}</div>
      <button class="btn btn-primary btn-block" style="margin-top:auto" onclick="App.goToday()">Back to Today</button>
    </div>
  </div>`;
}

// ─── History ─────────────────────────────────────────────────────────────

function renderHistory() {
  const log = Store.state.sessionLog.slice().reverse();
  if (log.length === 0) {
    return `<div class="empty-state"><h3>No sessions yet</h3><p>Finish your first workout and it'll show up here.</p></div>`;
  }
  const items = log.map(entry => {
    const chips = ['warmup', 'skill', 'wod', 'core'].map(s => entry.ratings[s]
      ? `<span class="tag ${RATING_TAG_CLASS[entry.ratings[s]]}">${SECTION_TITLES[s]}: ${RATING_LABEL[entry.ratings[s]]}</span>` : '').join('');
    return `<div class="card history-item">
      <div class="history-top">
        <div class="history-date">${entry.date}</div>
        <span class="tag tag-accent">${FOCUS_LABELS[entry.focus].toUpperCase()}</span>
      </div>
      <div class="history-line">${entry.wodBadge} · ${entry.wodMovements}</div>
      <div class="rating-chips">${chips}</div>
    </div>`;
  }).join('');
  return `<div class="section-heading">History</div><div class="card-list" style="padding-bottom:24px">${items}</div>`;
}

// ─── App controller ─────────────────────────────────────────────────────────

const App = {
  init() {
    UI.screen = Store.state.onboarded ? 'today' : 'onboarding';
    if (Store.state.onboarded) generateToday(Store.state);
    render();
  },

  goTab(tab) {
    UI.tab = tab;
    UI.screen = tab;
    if (tab === 'today') generateToday(Store.state);
    render();
  },
  goToday() { this.goTab('today'); },

  showInfo(key) { UI.dialog = key; render(); },
  closeDialog() { UI.dialog = null; render(); },

  applyPreset(key) {
    Store.state.equipment = EQUIPMENT_PRESETS[key].items.slice();
    Store.save(); render();
  },
  toggleEquip(id) {
    const eq = Store.state.equipment;
    const idx = eq.indexOf(id);
    if (idx >= 0) eq.splice(idx, 1); else eq.push(id);
    Store.save(); render();
  },
  finishOnboarding() {
    Store.state.onboarded = true;
    Store.save();
    generateToday(Store.state);
    UI.screen = 'today'; UI.tab = 'today';
    render();
  },
  confirmReset() {
    if (confirm('Reset all WODshed data on this device? This cannot be undone.')) {
      Store.reset();
      this.init();
    }
  },

  acceptBenchmark() {
    swapWodToBenchmark(Store.state);
    render();
  },
  dismissBenchmark() {
    Store.state.today.benchmarkOffer = null;
    Store.save(); render();
  },

  startOrResume() {
    const plan = Store.state.today;
    const order = ['warmup', 'skill', 'wod', 'core'];
    const next = order.find(s => !plan.completed[s]);
    if (next) this.enterExec(next);
  },

  enterExec(section) {
    UI.execSection = section; UI.screen = 'exec';
    if (UI.timer) { UI.timer.destroy(); UI.timer = null; }
    const plan = Store.state.today;

    if (section === 'warmup') {
      UI.warmupChecks = new Array(plan.warmup.moves.length * plan.warmup.rounds).fill(false);
      UI.timer = new WTimer({ mode: 'up', onTick: () => { const e = byId('warmupTime'); if (e) e.textContent = fmtClock(UI.timer.elapsedMs()); } });
      UI.timer.start(); UI.running = true;
    } else if (section === 'skill') {
      const s = plan.skill;
      if (s.shape === 'A') {
        UI.skillSetIndex = 0; UI.skillWeight = s.weight; UI.skillResting = false;
      } else if (s.shape === 'B') {
        UI.bRoundIndex = 1;
        UI.timer = new WTimer({
          mode: 'down', durationMs: s.intervalSec * 1000,
          onTick: () => { const e = byId('bTime'); if (e) e.textContent = fmtClock(UI.timer.remainingMs()); },
          onComplete: () => this.advanceSkillB(),
        });
        UI.timer.start(); UI.running = true;
      } else {
        UI.skillRoundIndex = 1; UI.skillResting = false;
      }
    } else if (section === 'wod') {
      const w = plan.wod;
      UI.wodStepIndex = 0; UI.wodRftRound = 0; UI.wodAmrapRounds = 0; UI.wodAmrapReps = 0; UI.bRoundIndex = 1;
      if (w.format === 'amrap') {
        UI.timer = new WTimer({
          mode: 'down', durationMs: w.capSec * 1000,
          onTick: () => { const e = byId('wodTime'); if (e) e.textContent = fmtClock(UI.timer.remainingMs()); },
          onComplete: () => this.finishAmrap(),
        });
      } else if (w.format === 'emom') {
        UI.timer = new WTimer({
          mode: 'down', durationMs: 60 * 1000,
          onTick: () => { const e = byId('bTime'); if (e) e.textContent = fmtClock(UI.timer.remainingMs()); },
          onComplete: () => this.advanceWodEmom(),
        });
      } else {
        UI.timer = new WTimer({ mode: 'up', onTick: () => { const e = byId('wodTime'); if (e) e.textContent = fmtClock(UI.timer.elapsedMs()); } });
      }
      UI.timer.start(); UI.running = true;
    } else if (section === 'core') {
      const c = plan.core;
      if (c.shape === 'tabata' || c.shape === 'holds') {
        UI.coreRound = 1; UI.corePhase = c.shape === 'tabata' ? 'work' : 'hold';
        const dur = (c.shape === 'tabata' ? c.workSec : c.holdSec) * 1000;
        UI.timer = new WTimer({
          mode: 'down', durationMs: dur,
          onTick: () => { const e = byId('coreTime'); if (e) e.textContent = Math.ceil(UI.timer.remainingMs() / 1000); },
          onComplete: () => this.advanceCorePhase(),
        });
        UI.timer.start(); UI.running = true;
      } else {
        UI.coreChecks = new Array(c.moves.length * c.rounds).fill(false);
        UI.timer = new WTimer({ mode: 'up', onTick: () => { const e = byId('coreTimeUp'); if (e) e.textContent = fmtClock(UI.timer.elapsedMs()); } });
        UI.timer.start(); UI.running = true;
      }
    }
    render();
  },

  exitExec() {
    if (UI.timer) { UI.timer.destroy(); UI.timer = null; }
    UI.screen = 'today'; render();
  },

  toggleTimer() {
    if (!UI.timer) return;
    UI.timer.toggle(); UI.running = UI.timer.running; render();
  },

  toggleWarmupCheck(i) { UI.warmupChecks[i] = !UI.warmupChecks[i]; render(); },
  finishWarmup() {
    UI.pendingResult = { checked: UI.warmupChecks.filter(Boolean).length, total: UI.warmupChecks.length };
    this.goToRating('warmup');
  },

  adjustWeight(dir) {
    const s = Store.state.today.skill;
    const inc = LIFT_INCREMENT[s.liftId] || 5;
    UI.skillWeight = Math.max(0, UI.skillWeight + dir * inc);
    render();
  },
  completeSet() {
    const s = Store.state.today.skill;
    if (UI.skillSetIndex + 1 >= s.scheme.length) {
      UI.pendingResult = { weight: UI.skillWeight, reps: s.scheme[s.scheme.length - 1] };
      this.goToRating('skill');
      return;
    }
    UI.skillSetIndex += 1;
    UI.skillResting = true;
    UI.timer = new WTimer({
      mode: 'down', durationMs: s.rest * 1000,
      onTick: () => { const e = byId('restTime'); if (e) e.textContent = fmtClock(UI.timer.remainingMs()); },
      onComplete: () => { UI.skillResting = false; render(); },
    });
    UI.timer.start();
    render();
  },
  skipRest() {
    if (UI.timer) UI.timer.destroy();
    UI.skillResting = false; render();
  },
  completeSkillRound() {
    const s = Store.state.today.skill;
    if (UI.skillRoundIndex >= s.rounds) {
      UI.pendingResult = {};
      this.goToRating('skill');
      return;
    }
    UI.skillRoundIndex += 1;
    UI.skillResting = true;
    UI.timer = new WTimer({
      mode: 'down', durationMs: s.rest * 1000,
      onTick: () => { const e = byId('restTime'); if (e) e.textContent = fmtClock(UI.timer.remainingMs()); },
      onComplete: () => { UI.skillResting = false; render(); },
    });
    UI.timer.start();
    render();
  },
  advanceSkillB() {
    const s = Store.state.today.skill;
    if (UI.bRoundIndex >= s.rounds) {
      UI.pendingResult = {};
      this.goToRating('skill');
      return;
    }
    UI.bRoundIndex += 1;
    UI.timer.reset(s.intervalSec * 1000);
    UI.timer.start();
    render();
  },
  skillSkipRound() { this.advanceSkillB(); },

  wodRoundDone() {
    const w = Store.state.today.wod;
    if (w.format === 'ladder') {
      if (UI.wodStepIndex + 1 >= w.steps.length) { this.finishWodWithClock(); return; }
      UI.wodStepIndex += 1;
    } else if (w.format === 'rft') {
      if (UI.wodRftRound + 1 >= w.rounds) { this.finishWodWithClock(); return; }
      UI.wodRftRound += 1;
    }
    render();
  },
  finishFortime() { this.finishWodWithClock(); },
  finishWodWithClock() {
    UI.pendingResult = { score: fmtClock(UI.timer ? UI.timer.elapsedMs() : 0) };
    this.goToRating('wod');
  },
  amrapAddRound() { UI.wodAmrapRounds += 1; render(); },
  amrapAddRep(d) { UI.wodAmrapReps = Math.max(0, UI.wodAmrapReps + d); render(); },
  finishAmrap() {
    UI.pendingResult = { score: `${UI.wodAmrapRounds}+${UI.wodAmrapReps}` };
    this.goToRating('wod');
  },
  advanceWodEmom() {
    const w = Store.state.today.wod;
    if (UI.bRoundIndex >= w.rounds) {
      UI.pendingResult = { score: `${w.rounds} rounds` };
      this.goToRating('wod');
      return;
    }
    UI.bRoundIndex += 1;
    UI.timer.reset(60 * 1000);
    UI.timer.start();
    render();
  },
  wodSkipRound() { this.advanceWodEmom(); },

  advanceCorePhase() {
    const c = Store.state.today.core;
    if (c.shape === 'tabata') {
      if (UI.corePhase === 'work') {
        UI.corePhase = 'rest';
        UI.timer.reset(c.restSec * 1000); UI.timer.start();
      } else if (UI.coreRound >= c.rounds) {
        this.finishCore();
      } else {
        UI.coreRound += 1; UI.corePhase = 'work';
        UI.timer.reset(c.workSec * 1000); UI.timer.start();
      }
    } else {
      if (UI.corePhase === 'hold') {
        UI.corePhase = 'rest';
        UI.timer.reset(c.restSec * 1000); UI.timer.start();
      } else if (UI.coreRound >= c.rounds) {
        this.finishCore();
      } else {
        UI.coreRound += 1; UI.corePhase = 'hold';
        UI.timer.reset(c.holdSec * 1000); UI.timer.start();
      }
    }
    render();
  },
  toggleCoreCheck(i) { UI.coreChecks[i] = !UI.coreChecks[i]; render(); },
  finishCore() {
    UI.pendingResult = {};
    this.goToRating('core');
  },

  goToRating(section) {
    if (UI.timer) { UI.timer.destroy(); UI.timer = null; }
    UI.execSection = section; UI.screen = 'rating';
    render();
  },

  rate(value) {
    completeSection(Store.state, UI.execSection, value, UI.pendingResult);
    const plan = Store.state.today;
    const order = ['warmup', 'skill', 'wod', 'core'];
    const next = order.find(s => !plan.completed[s]);
    if (next) this.enterExec(next);
    else { UI.screen = 'summary'; render(); }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
