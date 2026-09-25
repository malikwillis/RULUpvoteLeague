import { TEAMS, getTeam } from './data.js';
import { SCHEDULE, SPECIAL_EVENTS, matchScheduledResult } from './schedule.js';
import { teamTotal } from './core.js';

const filters = { week: '', teamId: '' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dateLabel = date => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const badge = team => `<span class="team-badge small" style="--team-color:${team.color}">${esc(team.abbr)}</span>`;

export function renderSchedule(container, { games = [], onScore, onLineups, onBoxScore = () => {} }) {
  container.innerHTML = `<div class="page-head"><div><div class="eyebrow">THE ROAD THROUGH THE SEASON</div><h1>The schedule.</h1><p class="muted">10 weeks. 40 matchups. One league. September–November 2026.</p></div><a href="#games" class="button secondary">View standings ↗</a></div>
    <div class="filters"><label>WEEK<select id="schedule-week" aria-label="Filter schedule by week"><option value="">All weeks</option>${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${filters.week === String(i + 1) ? 'selected' : ''}>Week ${i + 1}</option>`).join('')}</select></label><label>TEAM<select id="schedule-team" aria-label="Filter schedule by team"><option value="">All teams</option>${TEAMS.map(team => `<option value="${team.id}" ${filters.teamId === team.id ? 'selected' : ''}>${esc(team.name)}</option>`).join('')}</select></label><span id="schedule-count" class="filter-count"></span></div><div id="schedule-weeks"></div>`;

  function paint() {
    const fixtures = SCHEDULE.filter(game => (!filters.week || game.week === Number(filters.week)) && (!filters.teamId || [game.homeTeamId, game.awayTeamId].includes(filters.teamId)));
    const events = SPECIAL_EVENTS.filter(event => !filters.teamId && (!filters.week || event.week === Number(filters.week)));
    container.querySelector('#schedule-count').textContent = `${fixtures.length} LEAGUE GAME${fixtures.length === 1 ? '' : 'S'}${events.length ? ` · ${events.length} SPECIAL EVENTS` : ''}`;
    container.querySelector('#schedule-weeks').innerHTML = Array.from({ length: 10 }, (_, i) => i + 1).map(week => {
      const entries = [...fixtures.filter(game => game.week === week).map(game => ({ ...game, kind: 'game' })), ...events.filter(event => event.week === week).map(event => ({ ...event, kind: 'event' }))].sort((a, b) => a.date.localeCompare(b.date));
      if (!entries.length) return '';
      return `<section class="schedule-week" aria-label="Week ${week} schedule"><div class="section-head"><h2>Week ${week}</h2><span class="muted">${dateLabel(entries[0].date)}${entries[0].date === entries.at(-1).date ? '' : ` – ${dateLabel(entries.at(-1).date)}`}</span></div><div class="schedule-grid">${entries.map(entry => {
        if (entry.kind === 'event') return `<article class="special-event"><div class="eyebrow">ALL-STAR BREAK</div><h3>${esc(entry.title)}</h3><time datetime="${entry.date}">${dateLabel(entry.date)}</time><p class="muted">Special event · separate from league standings</p></article>`;
        const result = matchScheduledResult(entry, games);
        return `<article class="fixture-card" aria-label="Week ${week}: ${esc(getTeam(entry.homeTeamId).name)} vs ${esc(getTeam(entry.awayTeamId).name)}"><div class="fixture-top"><time datetime="${entry.date}">${dateLabel(entry.date)}</time><span class="status-pill ${result?.status || 'scheduled'}">${result?.status || 'Scheduled'}</span></div>${result && result.date !== entry.date ? `<div class="muted">Played ${dateLabel(result.date)}</div>` : ''}<div class="fixture-teams">${[entry.homeTeamId, entry.awayTeamId].map(id => {
          const team = getTeam(id);
          return `<div>${badge(team)}<strong>${esc(team.name)}</strong><b>${result ? teamTotal(result, id).toLocaleString('en-US') : '—'}</b></div>`;
        }).join('')}</div><div class="fixture-bottom">${result?.status === 'final' ? `<button type="button" class="text-link" data-schedule-box="${entry.id}">View box score ↗</button>` : ''}<button type="button" class="text-link" data-schedule-lineups="${week}">Week ${week} lineups ↗</button><button type="button" class="text-link" data-admin-only data-schedule-score="${entry.id}">${result ? 'Review / edit score' : 'Enter score'} ↗</button></div></article>`;
      }).join('')}</div></section>`;
    }).join('');
    container.querySelectorAll('[data-schedule-score]').forEach(button => button.addEventListener('click', () => onScore(SCHEDULE.find(game => game.id === button.dataset.scheduleScore))));
    container.querySelectorAll('[data-schedule-lineups]').forEach(button => button.addEventListener('click', () => onLineups(Number(button.dataset.scheduleLineups))));
    container.querySelectorAll('[data-schedule-box]').forEach(button => button.addEventListener('click', () => onBoxScore(matchScheduledResult(SCHEDULE.find(game => game.id === button.dataset.scheduleBox), games))));
  }

  container.querySelector('#schedule-week').addEventListener('change', event => { filters.week = event.target.value; paint(); });
  container.querySelector('#schedule-team').addEventListener('change', event => { filters.teamId = event.target.value; paint(); });
  paint();
}
