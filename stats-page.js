loadLeagueData().then(originalData => {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  const data = saved ? JSON.parse(saved) : originalData;

  pageHeader(data, 'stats.html', 'Player', 'Stats', 'Game Log Upvotes Only');
  pageFooter(data);

  const players = buildPlayersFromGameLogs(data);
  const teams = data.teams || [];
  const teamStats = buildTeamScheduleStats(data);

  const rankedPlayers = [...players].sort((a, b) => {
    return Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0)
      || cleanHandle(a.handle).localeCompare(cleanHandle(b.handle));
  });

  const rankedTeams = [...teamStats].sort((a, b) => {
    return Number(b.scheduleUpvotes || 0) - Number(a.scheduleUpvotes || 0)
      || String(a.name).localeCompare(String(b.name));
  });

  const leadersTarget = $('#leaders');
  const recordsTarget = $('#recordsGrid');
  const playersTarget = $('#playersTable');

  function statCard(label, value, subtext) {
    return `
      <article class="card">
        <div class="label">${escapeHtml(label)}</div>
        <div class="kpi">${value}</div>
        <p class="muted">${escapeHtml(subtext || '')}</p>
      </article>
    `;
  }

  function playerRows(list, limit = null) {
    const shown = limit ? list.slice(0, limit) : list;

    return shown.map((player, index) => `
      <div class="row">
        <span>
          <strong>${index + 1}. ${playerLink(player.handle)}</strong><br>
          <span class="muted">${teamLink(player.team)} · ${escapeHtml(player.conference || '')}${player.liveNow ? ' · Live now' : ''}</span>
        </span>
        <strong>${fmt(player.gameLogUpvotes)}</strong>
      </div>
    `).join('');
  }

  function renderPlayerCard(title, list, limit) {
    return `
      <article class="card">
        <h2 class="card-title">${escapeHtml(title)}</h2>
        ${list.length ? playerRows(list, limit) : '<div class="empty">No players found.</div>'}
      </article>
    `;
  }

  function renderTeamScheduleCard() {
    const rows = rankedTeams.map((team, index) => `
      <div class="row">
        <span>
          <strong>${index + 1}. ${teamLink(team.name)}</strong><br>
          <span class="muted">${escapeHtml(team.conference || '')} · ${escapeHtml(team.record || '')} · ${team.gamesPlayed} games</span>
        </span>
        <strong>${fmt(team.scheduleUpvotes)}</strong>
      </div>
    `).join('');

    return `
      <article class="card">
        <h2 class="card-title">Team Schedule Upvotes</h2>
        <p class="muted">Team totals use live and final game scores only.</p>
        ${rows || '<div class="empty">No team scores found.</div>'}
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
      filtered.sort((a, b) => String(a.team).localeCompare(String(b.team)) || Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0));
    } else {
      filtered.sort((a, b) => Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0));
    }

    const rows = filtered.map((player, index) => [
      index + 1,
      playerLink(player.handle),
      teamLink(player.team),
      escapeHtml(player.conference || ''),
      fmt(player.gameLogUpvotes),
      player.loggedGames,
      player.liveNow ? 'Live now' : 'No'
    ]);

    if (playersTarget) {
      playersTarget.innerHTML = `
        <h2 class="card-title">All Current Players</h2>
        <p class="muted">This table only uses game log upvotes from box scores. Old roster upvote fields are ignored.</p>
        ${table(['Rank', 'Player', 'Team', 'Conf', 'Game Log Upvotes', 'Games Logged', 'Live'], rows)}
      `;
    }
  }

  if (leadersTarget) {
    const topPlayer = rankedPlayers[0];
    const topTeam = rankedTeams[0];
    const totalGameLogUpvotes = players.reduce((sum, player) => sum + Number(player.gameLogUpvotes || 0), 0);
    const livePlayers = players.filter(player => player.liveNow).length;

    leadersTarget.innerHTML = `
      ${statCard('Top Game Log Player', topPlayer ? `@${escapeHtml(cleanHandle(topPlayer.handle))}` : 'None', topPlayer ? `${fmt(topPlayer.gameLogUpvotes)} game log upvotes · ${topPlayer.team}` : '')}
      ${statCard('Top Schedule Team', topTeam ? escapeHtml(topTeam.name) : 'None', topTeam ? `${fmt(topTeam.scheduleUpvotes)} schedule upvotes` : '')}
      ${statCard('Total Game Log Upvotes', fmt(totalGameLogUpvotes), 'Sum of player box score upvotes only')}
      ${statCard('Live Players', fmt(livePlayers), 'Players in live box scores right now')}
    `;
  }

  if (recordsTarget) {
    const eastPlayers = rankedPlayers.filter(player => String(player.conference).toLowerCase() === 'east');
    const westPlayers = rankedPlayers.filter(player => String(player.conference).toLowerCase() === 'west');
    const livePlayers = rankedPlayers.filter(player => player.liveNow);

    recordsTarget.innerHTML = `
      ${renderTeamScheduleCard()}
      ${livePlayers.length ? renderPlayerCard('Live Game Log Upvotes', livePlayers, 12) : ''}
      ${renderPlayerCard('Top 10 Game Log Upvotes', rankedPlayers, 10)}
      ${renderPlayerCard('East Game Log Leaders', eastPlayers, 8)}
      ${renderPlayerCard('West Game Log Leaders', westPlayers, 8)}
    `;
  }

  const search = $('#search');
  const sort = $('#sort');

  if (search) search.addEventListener('input', renderAllPlayers);
  if (sort) sort.addEventListener('change', renderAllPlayers);

  renderAllPlayers();
}).catch(error => {
  console.error('Stats page failed:', error);
  const main = document.querySelector('main') || document.body;
  main.innerHTML = `
    <section class="card">
      <h1>Stats failed to load</h1>
      <p class="muted">${escapeHtml(error.message || 'Check stats-page.js and static-data.js.')}</p>
    </section>
  `;
});

function buildPlayersFromGameLogs(data) {
  return (data.teams || []).flatMap(team => {
    return (team.roster || []).map(player => {
      const handle = cleanHandle(player.handle);
      const log = getPlayerGameLog(data, handle);
      const gameLogUpvotes = log.reduce((sum, item) => sum + Number(item.upvotes || 0), 0);
      const liveNow = log.some(item => item.status === 'Live');

      return {
        handle,
        team: team.name,
        conference: team.conference || '',
        gameLogUpvotes,
        loggedGames: log.length,
        liveNow
      };
    });
  });
}

function getPlayerGameLog(data, handle) {
  const target = cleanHandle(handle).toLowerCase();
  const log = [];

  (data.games || []).forEach(game => {
    if (!game.boxScore) return;

    const status = getGameStatus(game);
    if (status !== 'Final' && status !== 'Live') return;

    const teamAPlayers = game.boxScore.teamA || [];
    const teamBPlayers = game.boxScore.teamB || [];

    const teamAPlayer = teamAPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);
    const teamBPlayer = teamBPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);

    if (!teamAPlayer && !teamBPlayer) return;

    const entry = teamAPlayer || teamBPlayer;

    log.push({
      week: game.week || '',
      status,
      upvotes: Number(entry.upvotes || 0)
    });
  });

  return log;
}

function buildTeamScheduleStats(data) {
  const stats = {};

  (data.teams || []).forEach(team => {
    stats[team.name] = {
      name: team.name,
      conference: team.conference || '',
      record: team.record || '',
      scheduleUpvotes: 0,
      gamesPlayed: 0,
      averageUpvotes: 0
    };
  });

  (data.games || []).forEach(game => {
    const status = getGameStatus(game);
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

  return Object.values(stats);
}

function getGameStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}
