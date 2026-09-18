import {TEAMS,getTeam} from './data.js';
import {leagueState} from './access.js';
import {INITIAL_PICKS} from './capital-data.js';
const esc = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const picksForTeam = teamId => (leagueState().picks || INITIAL_PICKS).filter(p=>p.ownerTeamId===teamId).sort((a,b)=>a.season-b.season||a.round-b.round||a.originalTeamId.localeCompare(b.originalTeamId));
export function teamCapitalHTML(teamId) {
  const picks=picksForTeam(teamId);
  return `<div class="section-head"><h3>Draft capital</h3><span class="pill">${picks.length} PICKS</span></div>${picks.length?`<ul class="pick-list">${picks.map(p=>`<li><span><strong>S${p.season} · Round ${p.round}</strong><small class="muted">${esc(getTeam(p.originalTeamId)?.name)} original pick</small></span><span class="pill">${p.originalTeamId===teamId?'OWN':'ACQUIRED'}</span></li>`).join('')}</ul>`:'<p class="muted">No picks held.</p>'}`;
}
export function renderDraftCapital(container) {
  container.innerHTML=`<div class="page-head"><div><div class="eyebrow">BUILD FOR NEXT SEASON</div><h1>Draft capital.</h1><p class="muted">Season 3 picks, with current holders and original teams.</p></div><a class="button secondary" data-admin-only href="#trades">Trade desk ↗</a></div><div class="roster-grid">${TEAMS.map(t=>`<section class="roster-card"><header><span class="team-badge" style="--team-color:${t.color}">${esc(t.abbr)}</span><div><h2>${esc(t.name)}</h2><p class="muted">GM ${esc(t.gmHandle)}</p></div></header><div class="panel-body">${teamCapitalHTML(t.id)}</div></section>`).join('')}</div>`;
}
