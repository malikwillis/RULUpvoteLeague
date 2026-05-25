loadLeagueData().then(originalData => {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  const data = saved ? JSON.parse(saved) : originalData;

  pageHeader(data, 'standings.html', 'League', 'Standings', 'Overall, East, and West standings');
  pageFooter(data);

  const root = $('#standingsRoot') || document.querySelector('main') || document.body;
  const teams = data.teams || [];
  const scheduleStats = buildStandingsScheduleStats(data);
  const standings = teams.map(team => {
    const record = parseRecord(team.record || '0-0');
    const confRecord = parseRecord(team.conferenceRecord || '0-0');
    const stats = scheduleStats[team.name] || {
      scheduleUpvotes: 0,
      gamesPlayed: 0,
      averageUpvotes: 0
    };

    return {
      ...team,
      wins: record.wins,
      losses: record.losses,
      pct: record.pct,
      confWins: confRecord.wins,
      confLosses: confRecord.losses,
      scheduleUpvotes: stats.scheduleUpvotes,
      gamesPlayed: stats.gamesPlayed,
      averageUpvotes: stats.averageUpvotes,
      topPlayer: getTopTeamPlayer(data, team)
    };
  });

  const overall = sortStandings(standings);
  const east = sortStandings(standings.filter(team => String(team.conference || '').toLowerCase() === 'east'));
  const west = sortStandings(standings.filter(team => String(team.conference || '').toLowerCase() === 'west'));

  const totalLeagueUpvotes = standings.reduce((sum, team) => sum + Number(team.scheduleUpvotes || 0), 0);
  const topTeam = overall[0] || null;
  const topUpvoteTeam = [...standings].sort((a, b) => Number(b.scheduleUpvotes || 0) - Number(a.scheduleUpvotes || 0))[0] || null;

  root.innerHTML = `
    <section class="grid four">
      <article class="card">
        <div class="label">Top Record</div>
        <div class="kpi">${topTeam ? escapeHtml(topTeam.name) : 'None'}</div>
        <p class="muted">${topTeam ? escapeHtml(topTeam.record || '') : ''}</p>
      </article>

      <article class="card">
        <div class="label">Top Upvote Team</div>
        <div class="kpi">${topUpvoteTeam ? escapeHtml(topUpvoteTeam.name) : 'None'}</div>
        <p class="muted">${topUpvoteTeam ? `${fmt(topUpvoteTeam.scheduleUpvotes)} team schedule upvotes` : ''}</p>
      </article>

      <article class="card">
        <div class="label">League Upvotes</div>
        <div class="kpi">${fmt(totalLeagueUpvotes)}</div>
        <p class="muted">${fmt(teams.length)} teams</p>
      </article>

      <article class="card">
        <div class="label">Completed Games</div>
        <div class="kpi">${fmt(countCompletedGames(data))}</div>
        <p class="muted">Final games only</p>
      </article>
    </section>

    <section class="card" style="margin-top:16px">
      <div class="row">
        <span>
          <h2 class="card-title">Overall Standings</h2>
          <p class="muted">All RUL teams ranked together. Upvotes are team schedule totals, not one player.</p>
        </span>
        <span class="pill">${fmt(overall.length)} Teams</span>
      </div>
      ${standingsTable(overall)}
    </section>

    <section class="grid two" style="margin-top:16px">
      <article class="card">
        <h2 class="card-title">East Conference</h2>
        <p class="muted">East teams ranked by record and team schedule upvotes.</p>
        ${standingsTable(east)}
      </article>

      <article class="card">
        <h2 class="card-title">West Conference</h2>
        <p class="muted">West teams ranked by record and team schedule upvotes.</p>
        ${standingsTable(west)}
      </article>
    </section>

    <section class="card" style="margin-top:16px">
      <h2 class="card-title">Team Upvote Totals</h2>
      <p class="muted">These totals are calculated from each team's game scores in the schedule.</p>
      ${teamUpvoteTable([...standings].sort((a, b) => Number(b.scheduleUpvotes || 0) - Number(a.scheduleUpvotes || 0)))}
    </section>
  `;
}).catch(error => {
  console.error('Standings page failed:', error);
  const root = $('#standingsRoot') || document.querySelector('main') || document.body;
  root.innerHTML = `
    <section class="card">
      <h2>Standings failed to load</h2>
      <p class="muted">${escapeHtml(error.message || 'Check standings-page.js and static-data.js.')}</p>
    </section>
  `;
});

function buildStandingsScheduleStats(data) {
  const stats = {};

  (data.teams || []).forEach(team => {
    stats[team.name] = {
      scheduleUpvotes: 0,
      gamesPlayed: 0,
      averageUpvotes: 0
    };
  });

  (data.games || []).forEach(game => {
    const status = standingsGameStatus(game);
    if (status !== 'Final' && status !== 'Live') return;

    const aScore = Number(game.teamAScore || 0);
    const bScore = Number(game.teamBScore || 0);

    if (stats[game.teamA]) {
      stats[game.teamA].scheduleUpvotes += aScore;
      stats[game.teamA].gamesPlayed += 1;
    }

    if (stats[game.teamB]) {
      stats[game.teamB].scheduleUpvotes += bScore;
      stats[game.teamB].gamesPlayed += 1;
    }
  });

  Object.values(stats).forEach(team => {
    team.averageUpvotes = team.gamesPlayed ? Math.round(team.scheduleUpvotes / team.gamesPlayed) : 0;
  });

  return stats;
}

function standingsGameStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function countCompletedGames(data) {
  return (data.games || []).filter(game => standingsGameStatus(game) === 'Final').length;
}

function sortStandings(list) {
  return [...list].sort((a, b) => {
    return Number(b.wins || 0) - Number(a.wins || 0)
      || Number(a.losses || 0) - Number(b.losses || 0)
      || Number(b.scheduleUpvotes || 0) - Number(a.scheduleUpvotes || 0)
      || String(a.name).localeCompare(String(b.name));
  });
}

function standingsTable(list) {
  const rows = list.map((team, index) => [
    index + 1,
    teamLink(team.name),
    escapeHtml(team.record || '0-0'),
    escapeHtml(team.conferenceRecord || '0-0'),
    fmt(team.scheduleUpvotes),
    fmt(team.averageUpvotes),
    team.topPlayer ? playerLink(team.topPlayer.handle) : 'None'
  ]);

  return table(['#', 'Team', 'Record', 'Conf Record', 'Team Upvotes', 'Avg', 'Top Player'], rows);
}

function teamUpvoteTable(list) {
  const rows = list.map((team, index) => [
    index + 1,
    teamLink(team.name),
    escapeHtml(team.conference || ''),
    fmt(team.scheduleUpvotes),
    fmt(team.gamesPlayed),
    fmt(team.averageUpvotes)
  ]);

  return table(['#', 'Team', 'Conf', 'Team Upvotes', 'Games', 'Avg'], rows);
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
    const status = standingsGameStatus(game);
    if (status !== 'Final' && status !== 'Live') return;

    const allPlayers = [
      ...(game.boxScore.teamA || []),
      ...(game.boxScore.teamB || [])
    ];

    const entry = allPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);
    if (entry) {
      total += Number(entry.upvotes || 0);
    }
  });

  return total;
}
