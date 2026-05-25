loadLeagueData().then(originalData => {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  const data = saved ? JSON.parse(saved) : originalData;

  pageHeader(data, 'teams.html', 'League', 'Teams', 'Teams & Franchises');
  pageFooter(data);

  const main = document.querySelector('main.shell') || document.querySelector('main') || document.body;
  let root = document.getElementById('teamsRoot');

  if (!root) {
    root = document.createElement('section');
    root.id = 'teamsRoot';
    main.appendChild(root);
  }

  const teams = (data.teams || []).map(team => {
    const scheduleStats = getTeamScheduleStats(data, team.name);
    const topPlayer = getTopTeamPlayer(data, team);
    const recentGames = getRecentTeamGames(data, team.name);

    return {
      ...team,
      scheduleUpvotes: scheduleStats.scheduleUpvotes,
      gamesPlayed: scheduleStats.gamesPlayed,
      averageScore: scheduleStats.averageScore,
      topPlayer,
      recentGames
    };
  });

  const rankedTeams = sortTeamsByRecord(teams);
  const topRecord = rankedTeams[0];
  const topUpvotes = [...teams].sort((a, b) => Number(b.scheduleUpvotes || 0) - Number(a.scheduleUpvotes || 0))[0];
  const eastCount = teams.filter(team => String(team.conference || '').toLowerCase() === 'east').length;
  const westCount = teams.filter(team => String(team.conference || '').toLowerCase() === 'west').length;

  root.innerHTML = `
    <section class="grid four">
      ${teamSummaryCard('Top Record', topRecord ? escapeHtml(topRecord.name) : 'None', topRecord ? escapeHtml(topRecord.record || '') : '')}
      ${teamSummaryCard('Top Upvotes', topUpvotes ? escapeHtml(topUpvotes.name) : 'None', topUpvotes ? `${fmt(topUpvotes.scheduleUpvotes)} schedule upvotes` : '')}
      ${teamSummaryCard('East Teams', fmt(eastCount), 'Conference count')}
      ${teamSummaryCard('West Teams', fmt(westCount), 'Conference count')}
    </section>

    <section class="card" style="margin-top:16px">
      <div class="row">
        <span>
          <h2 class="card-title">All Teams</h2>
          <p class="muted">Team pages repaired. Totals use schedule scores, not roster all time totals.</p>
        </span>
        <span class="pill">${fmt(teams.length)} Teams</span>
      </div>

      <div class="grid two" style="margin-top:16px">
        ${rankedTeams.map(renderTeamCard).join('')}
      </div>
    </section>
  `;
}).catch(error => {
  console.error('Teams page failed:', error);

  const main = document.querySelector('main.shell') || document.querySelector('main') || document.body;
  let root = document.getElementById('teamsRoot');

  if (!root) {
    root = document.createElement('section');
    root.id = 'teamsRoot';
    main.appendChild(root);
  }

  root.innerHTML = `
    <section class="card">
      <h2>Teams failed to load</h2>
      <p class="muted">${escapeHtml(error.message || 'Check teams-page.js and static-data.js.')}</p>
    </section>
  `;
});

function teamSummaryCard(label, value, subtext) {
  return `
    <article class="card">
      <div class="label">${escapeHtml(label)}</div>
      <div class="kpi">${value}</div>
      <p class="muted">${escapeHtml(subtext || '')}</p>
    </article>
  `;
}

function renderTeamCard(team) {
  const roster = team.roster || [];
  const topPlayer = team.topPlayer;
  const futurePicks = getFuturePicksForTeam(team.name);
  const recentGames = team.recentGames || [];

  return `
    <article class="card">
      <div class="row">
        <span>
          <div class="label">${escapeHtml(team.conference || '')} Conference</div>
          <h2 class="card-title">${teamLink(team.name)}</h2>
        </span>
        <span class="pill">${escapeHtml(team.record || '0-0')}</span>
      </div>

      <div class="grid two" style="margin-top:14px">
        <div class="mini-card">
          <div class="label">Schedule Upvotes</div>
          <div class="kpi">${fmt(team.scheduleUpvotes)}</div>
          <p class="muted">${fmt(team.gamesPlayed)} games logged</p>
        </div>

        <div class="mini-card">
          <div class="label">Top Player</div>
          <div class="kpi">${topPlayer ? playerLink(topPlayer.handle) : 'None'}</div>
          <p class="muted">${topPlayer ? `${fmt(topPlayer.gameLogUpvotes)} game log upvotes` : 'No game logs yet'}</p>
        </div>
      </div>

      <h3 style="margin-top:18px">Roster</h3>
      <div>
        ${roster.length ? roster.map(player => {
          const handle = cleanHandle(player.handle);
          const total = getPlayerGameLogTotal(window.RUL_STATIC_DATA || {}, handle);

          return `
            <div class="row">
              <span>${playerLink(handle)}</span>
              <strong>${fmt(total)}</strong>
            </div>
          `;
        }).join('') : '<div class="empty">No roster listed.</div>'}
      </div>

      <h3 style="margin-top:18px">Recent Games</h3>
      <div>
        ${recentGames.length ? recentGames.map(game => `
          <div class="row">
            <span>
              <strong>${escapeHtml(game.teamA)} vs ${escapeHtml(game.teamB)}</strong><br>
              <span class="muted">${escapeHtml(game.week || '')} · ${escapeHtml(game.note || '')}</span>
            </span>
            <strong>${fmt(game.teamAScore || 0)}-${fmt(game.teamBScore || 0)}</strong>
          </div>
        `).join('') : '<div class="empty">No recent games listed.</div>'}
      </div>

      <h3 style="margin-top:18px">Future Picks</h3>
      <p class="muted">${futurePicks.length ? futurePicks.map(escapeHtml).join(', ') : 'No future picks listed.'}</p>
    </article>
  `;
}

function getTeamScheduleStats(data, teamName) {
  let scheduleUpvotes = 0;
  let gamesPlayed = 0;

  (data.games || []).forEach(game => {
    const status = teamPageGameStatus(game);
    if (status !== 'Final' && status !== 'Live') return;

    if (game.teamA === teamName) {
      scheduleUpvotes += Number(game.teamAScore || 0);
      gamesPlayed += 1;
    }

    if (game.teamB === teamName) {
      scheduleUpvotes += Number(game.teamBScore || 0);
      gamesPlayed += 1;
    }
  });

  return {
    scheduleUpvotes,
    gamesPlayed,
    averageScore: gamesPlayed ? Math.round(scheduleUpvotes / gamesPlayed) : 0
  };
}

function getRecentTeamGames(data, teamName) {
  return (data.games || [])
    .filter(game => game.teamA === teamName || game.teamB === teamName)
    .filter(game => teamPageGameStatus(game) === 'Final' || teamPageGameStatus(game) === 'Live')
    .sort((a, b) => weekNumber(b.week) - weekNumber(a.week))
    .slice(0, 3);
}

function getTopTeamPlayer(data, team) {
  const players = (team.roster || []).map(player => {
    const handle = cleanHandle(player.handle);

    return {
      handle,
      gameLogUpvotes: getPlayerGameLogTotal(data, handle)
    };
  });

  return players.sort((a, b) => Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0))[0] || null;
}

function getPlayerGameLogTotal(data, handle) {
  const target = cleanHandle(handle).toLowerCase();
  let total = 0;

  (data.games || []).forEach(game => {
    if (!game.boxScore) return;

    const status = teamPageGameStatus(game);
    if (status !== 'Final' && status !== 'Live') return;

    const players = [
      ...(game.boxScore.teamA || []),
      ...(game.boxScore.teamB || [])
    ];

    const entry = players.find(player => cleanHandle(player.handle).toLowerCase() === target);
    if (entry) total += Number(entry.upvotes || 0);
  });

  return total;
}

function getFuturePicksForTeam(teamName) {
  const data = window.RUL_STATIC_DATA || {};
  const picks = data.futurePicks || {};
  return picks[teamName] || [];
}

function teamPageGameStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function sortTeamsByRecord(teams) {
  return [...teams].sort((a, b) => {
    const ar = parseRecord(a.record || '0-0');
    const br = parseRecord(b.record || '0-0');

    return br.wins - ar.wins
      || ar.losses - br.losses
      || Number(b.scheduleUpvotes || 0) - Number(a.scheduleUpvotes || 0)
      || String(a.name).localeCompare(String(b.name));
  });
}

function weekNumber(week) {
  const match = String(week || '').match(/\d+/);
  return match ? Number(match[0]) : 999;
}
