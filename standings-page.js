loadLeagueData().then(data => {
  pageHeader(data, 'standings.html', 'Season', 'Standings', 'Overall, East, and West Rankings');
  pageFooter(data);

  const standings = sortedStandings(data);
  const east = sortedStandings({ teams: data.teams.filter(team => String(team.conference).toLowerCase() === 'east') });
  const west = sortedStandings({ teams: data.teams.filter(team => String(team.conference).toLowerCase() === 'west') });

  const total = data.teams.reduce((sum, team) => sum + Number(team.totalUpvotes || 0), 0);
  const firstPlace = standings[0];
  const eastLeader = east[0];
  const westLeader = west[0];

  function safeTopPlayer(team) {
    if (!team || !team.roster || !team.roster.length) return '';
    return [...team.roster].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0]?.handle || '';
  }

  function standingRows(teams) {
    return teams.map((team, index) => [
      index + 1,
      teamLink(team.name),
      escapeHtml(team.conference),
      escapeHtml(team.record),
      escapeHtml(team.conferenceRecord),
      fmt(team.totalUpvotes),
      playerLink(safeTopPlayer(team))
    ]);
  }

  function standingsCard(title, subtitle, teams) {
    return `
      <section class="card standings-card">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <h2 class="card-title">${escapeHtml(title)}</h2>
            <p class="muted" style="margin:4px 0 0">${escapeHtml(subtitle)}</p>
          </div>
          <span class="pill">${teams.length} Teams</span>
        </div>
        ${table(['Rank','Team','Conf','Record','Conf Record','Upvotes','Top Player'], standingRows(teams))}
      </section>
    `;
  }

  $('#kpis').innerHTML = `
    <article class="card">
      <div class="label">Overall Leader</div>
      <div class="kpi">${escapeHtml(firstPlace?.name || 'TBD')}</div>
      <p class="muted">${escapeHtml(firstPlace?.record || '')}</p>
    </article>
    <article class="card">
      <div class="label">East Leader</div>
      <div class="kpi">${escapeHtml(eastLeader?.name || 'TBD')}</div>
      <p class="muted">${escapeHtml(eastLeader?.record || '')}</p>
    </article>
    <article class="card">
      <div class="label">West Leader</div>
      <div class="kpi">${escapeHtml(westLeader?.name || 'TBD')}</div>
      <p class="muted">${escapeHtml(westLeader?.record || '')}</p>
    </article>
    <article class="card">
      <div class="label">League Upvotes</div>
      <div class="kpi">${fmt(total)}</div>
      <p class="muted">${data.teams.length} teams</p>
    </article>
  `;

  $('#standingsTable').outerHTML = `
    <section id="standingsTable" style="display:grid;gap:16px;margin-top:16px">
      ${standingsCard('Overall Standings', 'All RUL teams ranked together.', standings)}
      <div class="grid two">
        ${standingsCard('East Conference', 'East teams ranked by record and upvotes.', east)}
        ${standingsCard('West Conference', 'West teams ranked by record and upvotes.', west)}
      </div>
    </section>
  `;
});
