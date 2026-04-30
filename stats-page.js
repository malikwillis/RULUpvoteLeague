loadLeagueData().then(data => {
  pageHeader(data, 'stats.html', 'Player', 'Stats', 'Upvote Leaderboards');
  pageFooter(data);

  const players = getCurrentPlayers(data);
  const byUpvotes = [...players].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0));
  const teams = data.teams || [];

  function renderStatCard(label, value, subtext) {
    return `
      <article class="card">
        <div class="label">${escapeHtml(label)}</div>
        <div class="kpi">${value}</div>
        <p class="muted">${escapeHtml(subtext || '')}</p>
      </article>
    `;
  }

  function renderPlayerList(title, list, limit = 10) {
    const shown = [...list].slice(0, limit);
    return `
      <article class="card">
        <h2 class="card-title">${escapeHtml(title)}</h2>
        ${shown.length ? shown.map((player, index) => `
          <div class="row">
            <span>
              <strong>${index + 1}. ${playerLink(player.handle)}</strong><br>
              <span class="muted">${teamLink(player.team)} · ${escapeHtml(player.conference || '')}</span>
            </span>
            <strong>${fmt(player.upvotes)}</strong>
          </div>
        `).join('') : '<div class="empty">No players found.</div>'}
      </article>
    `;
  }

  function renderTeamLeaders() {
    return `
      <article class="card">
        <h2 class="card-title">Team Leaders</h2>
        ${teams.map(team => {
          const leader = [...(team.roster || [])].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0];
          return `
            <div class="row">
              <span>
                <strong>${teamLink(team.name)}</strong><br>
                <span class="muted">${escapeHtml(team.record || '')} · ${escapeHtml(team.conference || '')}</span>
              </span>
              <strong>${leader ? `${playerLink(leader.handle)} · ${fmt(leader.upvotes)}` : 'None'}</strong>
            </div>
          `;
        }).join('')}
      </article>
    `;
  }

  function renderAllPlayers() {
    const searchValue = normalize($('#search')?.value || '');
    const sortValue = $('#sort')?.value || 'upvotes';

    let filtered = players.filter(player => {
      if (!searchValue) return true;
      return normalize(player.handle).includes(searchValue)
        || normalize(player.team).includes(searchValue)
        || normalize(player.conference).includes(searchValue);
    });

    if (sortValue === 'name') {
      filtered.sort((a, b) => cleanHandle(a.handle).localeCompare(cleanHandle(b.handle)));
    } else if (sortValue === 'team') {
      filtered.sort((a, b) => String(a.team).localeCompare(String(b.team)) || Number(b.upvotes || 0) - Number(a.upvotes || 0));
    } else {
      filtered.sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0));
    }

    const rows = filtered.map((player, index) => {
      const team = teams.find(t => t.name === player.team);
      const officialTotal = Number(team?.totalUpvotes || 0);
      const share = officialTotal ? Math.round((Number(player.upvotes || 0) / officialTotal) * 100) + '%' : '0%';
      const previous = getPreviousTeam(data, player.handle);

      return [
        index + 1,
        playerLink(player.handle),
        teamLink(player.team),
        escapeHtml(player.conference || ''),
        fmt(player.upvotes),
        share,
        previous ? escapeHtml(previous) : 'None'
      ];
    });

    const tableTarget = $('#playersTable');
    if (tableTarget) {
      tableTarget.innerHTML = `<h2 class="card-title">All Current Players</h2>` + table(['Rank', 'Player', 'Team', 'Conf', 'Upvotes', 'Team Share', 'Previous Team'], rows);
    }
  }

  function renderRecords() {
    const eastPlayers = byUpvotes.filter(player => String(player.conference).toLowerCase() === 'east');
    const westPlayers = byUpvotes.filter(player => String(player.conference).toLowerCase() === 'west');

    const recordsTarget = $('#recordsGrid');
    if (!recordsTarget) return;

    recordsTarget.innerHTML = `
      ${renderPlayerList('Top 10 Overall Upvotes', byUpvotes, 10)}
      ${renderPlayerList('East Conference Leaders', eastPlayers, 8)}
      ${renderPlayerList('West Conference Leaders', westPlayers, 8)}
      ${renderTeamLeaders()}
    `;
  }

  const leadersTarget = $('#leaders');
  if (leadersTarget) {
    const totalPlayers = players.length;
    const totalUpvotes = players.reduce((sum, player) => sum + Number(player.upvotes || 0), 0);
    const topPlayer = byUpvotes[0];
    const topTeam = [...teams].sort((a, b) => Number(b.totalUpvotes || 0) - Number(a.totalUpvotes || 0))[0];

    leadersTarget.innerHTML = `
      ${renderStatCard('Top Player', topPlayer ? `@${escapeHtml(cleanHandle(topPlayer.handle))}` : 'None', topPlayer ? `${fmt(topPlayer.upvotes)} upvotes · ${topPlayer.team}` : '')}
      ${renderStatCard('Top Team', topTeam ? escapeHtml(topTeam.name) : 'None', topTeam ? `${fmt(topTeam.totalUpvotes)} official upvotes` : '')}
      ${renderStatCard('Current Players', totalPlayers, 'Players on current rosters')}
      ${renderStatCard('Roster Upvotes', fmt(totalUpvotes), 'Sum of current player upvotes')}
    `;
  }

  const search = $('#search');
  const sort = $('#sort');
  if (search) search.addEventListener('input', renderAllPlayers);
  if (sort) sort.addEventListener('change', renderAllPlayers);

  renderAllPlayers();
  renderRecords();
}).catch(error => {
  console.error('Stats page failed:', error);
  const main = document.querySelector('main') || document.body;
  main.innerHTML = `
    <div class="card">
      <h1>Stats failed to load</h1>
      <p class="muted">The stats page could not read the data file. Check that static-data.js, utils.js, data-service.js, layout.js, and stats-page.js are all uploaded in the main repo folder.</p>
    </div>
  `;
});

function getCurrentPlayers(data) {
  return (data.teams || []).flatMap(team => {
    return (team.roster || []).map(player => ({
      ...player,
      handle: cleanHandle(player.handle),
      team: team.name,
      conference: team.conference,
      teamTotal: team.totalUpvotes
    }));
  });
}

function getPreviousTeam(data, handle) {
  const key = cleanHandle(handle);
  const history = data.playerHistory?.[key];
  if (!history || !history.length) return '';
  return history[0]?.from || '';
}
