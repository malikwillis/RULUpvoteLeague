loadLeagueData().then(data => {
  const params = new URLSearchParams(location.search);
  const requested = normalize(params.get('player') || params.get('handle') || 'kenunderrated');
  const ps = allPlayers(data).sort((a,b) => b.upvotes - a.upvotes);
  const player = ps.find(p => normalize(p.handle) === requested) || ps[0];
  const rank = ps.findIndex(p => p.handle === player.handle) + 1;
  const team = data.teams.find(t => t.name === player.team);
  pageHeader(data, 'stats.html', '@' + player.handle, '', 'Official Player Profile');
  pageFooter(data);
  $('#profileRoot').innerHTML = `<section class="card profile-hero"><div><div class="label">${teamLink(player.team)}</div><div class="kpi">@${escapeHtml(player.handle)}</div><p class="muted">${fmt(player.upvotes)} upvotes • #${rank} in the league • ${escapeHtml(player.conference)} Conference</p></div><div class="avatar" style="background:linear-gradient(135deg,${escapeHtml(player.accent)},var(--gold))">${escapeHtml(player.handle[0]?.toUpperCase() || 'R')}</div></section><section class="grid four" style="margin-top:16px"><article class="card"><div class="label">Upvotes</div><div class="kpi">${fmt(player.upvotes)}</div></article><article class="card"><div class="label">Rank</div><div class="kpi">#${rank}</div></article><article class="card"><div class="label">Team Share</div><div class="kpi">${Math.round((Number(player.upvotes) / Math.max(1, Number(player.teamTotal))) * 100)}%</div></article><article class="card"><div class="label">Team Record</div><div class="kpi">${escapeHtml(team?.record || '0-0')}</div></article></section><section class="card" style="margin-top:16px"><h2 class="card-title">Team Context</h2><div class="row"><span>Team</span><strong>${teamLink(player.team)}</strong></div><div class="row"><span>Conference</span><strong>${escapeHtml(player.conference)}</strong></div><div class="row"><span>Team Upvotes</span><strong>${fmt(player.teamTotal)}</strong></div></section>`;
});
