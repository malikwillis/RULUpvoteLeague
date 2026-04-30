loadLeagueData().then(data => {
  pageHeader(data, 'standings.html', 'Season', 'Standings', 'League Table & Rankings');
  pageFooter(data);
  const standings = sortedStandings(data);
  const top = standings[0];
  const total = data.teams.reduce((s,t) => s + Number(t.totalUpvotes || 0), 0);
  $('#kpis').innerHTML = `<article class="card"><div class="label">First Place</div><div class="kpi">${escapeHtml(top.name)}</div></article><article class="card"><div class="label">Best Record</div><div class="kpi">${escapeHtml(top.record)}</div></article><article class="card"><div class="label">League Upvotes</div><div class="kpi">${fmt(total)}</div></article><article class="card"><div class="label">Teams</div><div class="kpi">${data.teams.length}</div></article>`;
  const rows = standings.map((team, index) => [index + 1, teamLink(team.name), escapeHtml(team.conference), escapeHtml(team.record), escapeHtml(team.conferenceRecord), fmt(team.totalUpvotes), playerLink([...team.roster].sort((a,b)=>b.upvotes-a.upvotes)[0]?.handle || '')]);
  $('#standingsTable').innerHTML = `<h2 class="card-title">Official Standings</h2>` + table(['Rank','Team','Conf','Record','Conf Record','Upvotes','Top Player'], rows);
});
