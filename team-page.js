loadLeagueData().then(data => {
  const params = new URLSearchParams(location.search);
  const requested = normalize(params.get('team') || 'Phantoms');
  const team = data.teams.find(t => normalize(t.name) === requested || normalize(t.id) === requested) || data.teams[0];
  pageHeader(data, 'teams.html', team.name, '', 'Team Profile');
  pageFooter(data);
  const top = [...team.roster].sort((a,b) => b.upvotes - a.upvotes)[0] || {handle:'none', upvotes:0};
  const games = data.games.filter(g => g.teamA === team.name || g.teamB === team.name);
  $('#teamRoot').innerHTML = `<section class="grid four"><article class="card"><div class="label">Record</div><div class="kpi">${escapeHtml(team.record)}</div></article><article class="card"><div class="label">Conference</div><div class="kpi">${escapeHtml(team.conference)}</div></article><article class="card"><div class="label">Upvotes</div><div class="kpi">${fmt(team.totalUpvotes)}</div></article><article class="card"><div class="label">Top Player</div><div class="kpi">@${escapeHtml(top.handle)}</div></article></section><section class="grid two" style="margin-top:16px"><article class="card"><h2 class="card-title">Roster</h2>${[...team.roster].sort((a,b)=>b.upvotes-a.upvotes).map(p => `<div class="row"><span>${playerLink(p.handle)}</span><strong>${fmt(p.upvotes)}</strong></div>`).join('')}</article><article class="card"><h2 class="card-title">Future Picks</h2>${(data.futurePicks[team.name] || []).map(pick => `<div class="row"><span>${escapeHtml(pick)}</span><span class="pill">Pick</span></div>`).join('') || '<p class="muted">No picks listed.</p>'}</article></section><section class="card" style="margin-top:16px"><h2 class="card-title">Team Schedule</h2><div class="live-list">${games.map(g => renderGameCard(g, data)).join('')}</div></section>`;
});
