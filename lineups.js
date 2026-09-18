import { TEAMS, PLAYERS, getTeam, getPlayer } from './data.js';
import { getWeekMatchups } from './schedule.js';
import { access, leagueState, canSubmitLineups, isCommissioner, saveLeagueLineup, onAccessChange } from './access.js';

const STORAGE_KEY = 'rul-redesign-lineups-v1';
export const LINEUP_SIZE = 4;
const drafts = new Map();
const profileListeners = new WeakMap();
const views = { public: { week: 1 }, gm: { week: 1, teamId: TEAMS[0].id } };
let activeView = null;
let listening = false;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const lineupKey = (teamId, week) => `${teamId}:${week}`;
const validWeek = week => Number.isSafeInteger(week) && week >= 1;
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateLineupShape(lineup, rosters = null) {
  if (!plainObject(lineup)) return ['Lineup is missing.'];
  const errors = [];
  const team = getTeam(lineup.teamId);
  if (!team) errors.push('Choose a valid team.');
  if (!validWeek(lineup.week)) errors.push('Week must be a positive whole number.');
  if (!Array.isArray(lineup.playerIds)) return [...errors, 'Choose at least one player.'];
  if (lineup.playerIds.length === 0) errors.push('Choose at least one player.');
  if (new Set(lineup.playerIds).size !== lineup.playerIds.length) errors.push('Each player can appear only once.');
  if (lineup.playerIds.some(id => typeof id !== 'string' || !getPlayer(id) || (rosters ? rosters[id] : getPlayer(id)?.teamId) !== lineup.teamId)) errors.push('Every selected player must be on this team’s roster.');
  return errors;
}

export function validateLineup(lineup, {rosters = null} = {}) {
  const errors = validateLineupShape(lineup, rosters);
  if (Array.isArray(lineup?.playerIds) && lineup.playerIds.length !== LINEUP_SIZE) {
    errors.push(`Choose exactly ${LINEUP_SIZE} starters before saving.`);
  }
  return errors;
}

function readStore() {
  return {records: leagueState().lineups, error: access().error || null};
}

function badge(team) {
  return `<span class="team-badge" style="--team-color:${esc(team.color)}">${esc(team.abbr)}</span>`;
}

function heading(mode) {
  return `<div class="page-head"><div><div class="eyebrow">${mode === 'gm' ? 'GM WORKSPACE' : 'THE MATCHDAY ROSTER'}</div><h1>${mode === 'gm' ? 'Build your lineup.' : 'Matchday lineups.'}</h1><p class="muted">${mode === 'gm' ? 'Pick four starters. Save the lineup for the week.' : 'See who is in for each team.'}</p></div><div class="head-actions">${mode === 'public' ? '<a class="button secondary" href="#schedule">Full schedule</a>' : ''}<a class="button secondary" data-lineup-switch="${mode === 'gm' ? 'public' : 'gm'}" href="${mode === 'gm' ? '#lineups' : '#gm'}">${mode === 'gm' ? 'View public lineups' : 'GM sign-in / lineup'}</a></div></div>`;
}

function matchupContext(teamId, week) {
  const matchups = getWeekMatchups(week).filter(game => game.homeTeamId === teamId || game.awayTeamId === teamId);
  if (!matchups.length) return '<p class="muted" style="margin:5px 0 0">Schedule pending</p>';
  return matchups.map(game => {
    const opponent = getTeam(game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(game.date ?? '') ? new Date(`${game.date}T12:00:00Z`) : null;
    const dateLabel = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'Date pending';
    return `<p class="muted" style="margin:5px 0 0">${opponent ? `vs ${esc(opponent.name)}` : 'Schedule pending'} · ${esc(dateLabel)}</p>`;
  }).join('');
}

function weekField(week) {
  return `<label><span class="field-label">WEEK</span><input data-lineup-week type="number" min="1" step="1" inputmode="numeric" value="${esc(week)}" aria-label="Lineup week" required></label>`;
}

function getDraft(teamId, week, records) {
  const key = lineupKey(teamId, week);
  const previous = drafts.get(key);
  if (previous?.dirty) return previous;
  const draft = { playerIds: new Set(records[key]?.playerIds ?? []), dirty: false };
  drafts.set(key, draft);
  return draft;
}

function renderPublic(container, store) {
  const state = views.public;
  const submitted = TEAMS.filter(team => store.records[lineupKey(team.id, state.week)]?.playerIds.length === LINEUP_SIZE).length;
  container.innerHTML = `${heading('public')}
    <div class="form-panel" style="margin-bottom:24px"><div class="field-grid">${weekField(state.week)}<div style="align-self:end"><p class="muted" style="margin:0">${submitted} of ${TEAMS.length} lineups submitted for week ${esc(state.week)}</p></div></div></div>
    ${store.error ? `<div class="notice" role="alert" style="margin-bottom:24px">${esc(store.error)}</div>` : ''}
    <div class="roster-grid">${TEAMS.map(team => {
      const lineup = store.records[lineupKey(team.id, state.week)];
      const selected = lineup ? team.players.filter(player => lineup.playerIds.includes(player.id)) : [];
      return `<section class="roster-card" aria-label="${esc(team.name)} lineup"><div style="display:flex;align-items:center;gap:14px;padding:22px">${badge(team)}<div><h2 style="margin:0;font-size:22px">${esc(team.name)}</h2><p class="muted" style="margin:4px 0 0;overflow-wrap:anywhere">GM ${esc(team.gmHandle)}</p>${matchupContext(team.id, state.week)}<p class="muted" style="margin:4px 0 0">${lineup ? `${selected.length} of ${LINEUP_SIZE} starters${selected.length !== LINEUP_SIZE ? ' · Needs update' : ' selected'}` : 'Awaiting submission'}</p></div></div>
        ${lineup ? `<ul class="roster-list" style="list-style:none;margin:0;padding:0 22px 20px">${selected.map(player => `<li class="roster-player"><button type="button" class="handle text-link player-profile-link" data-lineup-stats="${esc(player.id)}" aria-label="View stats for ${esc(player.handle)}">${esc(player.handle)}</button>${player.note ? `<small class="muted">${esc(player.note)}</small>` : ''}</li>`).join('')}</ul>` : `<p class="muted" style="padding:0 22px 24px;margin:0">Lineup not submitted</p>`}</section>`;
    }).join('')}</div>
    <div class="callout" style="margin-top:24px"><strong>${access().config?.storage === 'local' ? 'Local preview' : 'League lineups'}</strong><p>Submitted lineups appear here automatically. Only the commissioner and each team’s verified GM can make changes.</p></div>`;
}

function renderGM(container, store) {
  const state = views.gm;
  const team = getTeam(state.teamId);
  const draft = getDraft(state.teamId, state.week, store.records);
  const saved = store.records[lineupKey(state.teamId, state.week)];
  container.innerHTML = `${heading('gm')}
    <div class="callout" style="margin-bottom:24px"><strong>${isCommissioner() ? 'Commissioner access' : 'Verified GM access'}</strong><p>${isCommissioner() ? 'You can manage all teams’ lineups.' : 'You can submit only your assigned team’s lineup.'}</p></div>
    ${store.error ? `<div class="notice" role="alert" style="margin-bottom:24px">${esc(store.error)}</div>` : ''}
    <form data-lineup-form class="form-panel"><div class="field-grid"><label><span class="field-label">TEAM</span><select data-lineup-team aria-label="Lineup team" ${!isCommissioner() ? 'disabled' : ''}>${TEAMS.map(item => `<option value="${esc(item.id)}" ${item.id === team.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>${weekField(state.week)}</div>
    <div style="display:flex;align-items:center;gap:14px;margin:30px 0 20px">${badge(team)}<div><h2 style="margin:0;font-size:24px">${esc(team.name)} · Week ${esc(state.week)}</h2><p class="muted" style="margin:5px 0 0;overflow-wrap:anywhere">Assigned GM: ${esc(team.gmHandle)}</p>${matchupContext(team.id, state.week)}<p class="muted" style="margin:5px 0 0">Choose ${LINEUP_SIZE} starters from ${team.players.length} rostered players.</p></div></div>
    <fieldset style="padding:0;margin:0;border:0"><legend class="field-label" style="margin-bottom:12px">SELECT PLAYERS</legend><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px">${team.players.map(player => `<div class="lineup-checkbox" style="margin:0;padding:16px;border:1px solid var(--line)"><input type="checkbox" name="lineup-player" value="${esc(player.id)}" aria-label="${esc(player.handle)}" ${draft.playerIds.has(player.id) ? 'checked' : draft.playerIds.size >= LINEUP_SIZE ? 'disabled' : ''} style="width:18px;height:18px;flex:0 0 18px;accent-color:${esc(team.color)}"><span style="min-width:0;overflow-wrap:anywhere"><button type="button" class="handle text-link player-profile-link" data-lineup-stats="${esc(player.id)}" aria-label="View stats for ${esc(player.handle)}">${esc(player.handle)}</button>${player.note ? `<small class="muted" style="display:block;margin-top:4px">${esc(player.note)}</small>` : ''}</span></div>`).join('')}</div></fieldset>
    <div data-lineup-error role="alert" class="notice" hidden style="margin-top:20px"></div>
    <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;margin-top:24px"><p class="muted" data-lineup-count aria-live="polite" style="margin:0">${draft.playerIds.size} of ${LINEUP_SIZE} starters selected</p><button class="button primary" type="submit" ${store.error ? 'disabled' : ''}>Save lineup</button></div>
    <p class="muted" data-lineup-status style="margin:18px 0 0">${draft.dirty ? 'Unsaved selections are kept while you switch teams or weeks.' : saved ? saved.playerIds.length !== LINEUP_SIZE ? 'This older lineup is preserved. Update it to four starters and save again.' : 'Saved lineup loaded. Changes will replace this team’s lineup for this week.' : 'Choose exactly four starters.'}</p></form>`;
}

function paint() {
  if (!activeView || !activeView.container.isConnected) return;
  const { container, mode, toast, onPlayer } = activeView;
  const store = readStore();
  if (mode === 'gm') renderGM(container, store);
  else renderPublic(container, store);
  const previousListener = profileListeners.get(container);
  if (previousListener) container.removeEventListener('click', previousListener);
  const profileListener = event => {
    const button = event.target.closest?.('[data-lineup-stats]');
    if (!button || !container.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    if (getPlayer(button.dataset.lineupStats)) onPlayer(button.dataset.lineupStats);
  };
  container.addEventListener('click', profileListener);
  profileListeners.set(container, profileListener);
  const state = views[mode];
  container.querySelector('[data-lineup-switch]').addEventListener('click', event => {
    views[event.currentTarget.dataset.lineupSwitch].week = state.week;
  });
  container.querySelector('[data-lineup-week]').addEventListener('change', event => {
    const nextWeek = Number(event.target.value);
    if (!validWeek(nextWeek)) { event.target.value = String(state.week); toast('Enter a positive whole-number week.'); return; }
    state.week = nextWeek;
    paint();
  });
  if (mode !== 'gm') return;
  container.querySelector('[data-lineup-team]').addEventListener('change', event => {
    if (!getTeam(event.target.value)) { toast('Choose a valid team.'); paint(); return; }
    state.teamId = event.target.value;
    paint();
  });
  const draft = getDraft(state.teamId, state.week, store.records);
  container.querySelectorAll('input[name="lineup-player"]').forEach(input => input.addEventListener('change', () => {
    if (input.checked && !draft.playerIds.has(input.value) && draft.playerIds.size >= LINEUP_SIZE) {
      input.checked = false;
      toast('Four starters selected. Remove a player before choosing another.');
      return;
    }
    if (input.checked) draft.playerIds.add(input.value);
    else draft.playerIds.delete(input.value);
    draft.dirty = true;
    container.querySelectorAll('input[name="lineup-player"]').forEach(checkbox => {
      checkbox.disabled = !checkbox.checked && draft.playerIds.size >= LINEUP_SIZE;
    });
    container.querySelector('[data-lineup-count]').textContent = `${draft.playerIds.size} of ${LINEUP_SIZE} starters selected`;
    container.querySelector('[data-lineup-status]').textContent = 'Unsaved selections are kept while you switch teams or weeks.';
    container.querySelector('[data-lineup-error]').hidden = true;
  }));
  container.querySelector('[data-lineup-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const lineup = { teamId: state.teamId, week: state.week, playerIds: PLAYERS.filter(player => draft.playerIds.has(player.id)).map(player => player.id), submittedAt: new Date().toISOString() };
    const errors = validateLineup(lineup);
    const fresh = readStore();
    if (fresh.error) errors.push(fresh.error);
    if (errors.length) {
      const notice = container.querySelector('[data-lineup-error]');
      notice.textContent = errors.join(' '); notice.hidden = false;
      return;
    }
    try {
      if(!canSubmitLineups())throw new Error('Sign in with editing permission.');
      await saveLeagueLineup(lineup);
    } catch (error) {
      const notice = container.querySelector('[data-lineup-error]');
      notice.textContent = error.message || 'The lineup could not be saved. Your selections are still here.';
      notice.hidden = false;
      return;
    }
    draft.dirty = false;
    toast(`${getTeam(lineup.teamId).name} lineup saved for week ${lineup.week}. It is visible on public lineups.`);
    paint();
  });
}

/** Mount one local lineup view. Repeat calls replace the active view without accumulating window listeners. */
export function renderLineups(container, { mode = 'public', toast = () => {}, onPlayer = () => {}, week } = {}) {
  if (!container || typeof container.querySelector !== 'function') throw new TypeError('A lineup container is required.');
  activeView = { container, mode: mode === 'gm' ? 'gm' : 'public', toast: typeof toast === 'function' ? toast : () => {}, onPlayer: typeof onPlayer === 'function' ? onPlayer : () => {} };
  if (validWeek(week)) views[activeView.mode].week = week;
  if(access().actor.role==='gm')views.gm.teamId=access().actor.teamId;
  if (!listening) {
    onAccessChange(kind => {
      if(kind==='auth')drafts.clear();
      if(activeView?.container.querySelector('[data-lineup-week]') && (activeView.mode==='public'||canSubmitLineups()))paint();
    });
    listening = true;
  }
  paint();
}
