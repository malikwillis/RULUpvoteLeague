loadLeagueData().then(originalData => {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  const data = saved ? JSON.parse(saved) : originalData;

  pageHeader(data, 'stats.html', 'Player', 'Stats', 'Game Log Upvote Leaderboards');
  pageFooter(data);

  const players = getCurrentPlayersWithGameLogTotals(data);
  const byGameLogUpvotes = [...players].sort((a, b) => {
    return Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0)
      || cleanHandle(a.handle).localeCompare(cleanHandle(b.handle));
  });

  const teams = data.teams || [];
  const scheduleStats = getScheduleTeamStats(data);

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
              <span class="muted">${teamLink(player.team)} · ${escapeHtml(player.conference || '')}${player.liveGames ? ' · Live now' : ''}</span>
            </span>
            <strong>${fmt(player.gameLogUpvotes)}</strong>
          </div>
        `).join('') : '<div class="empty">No players found.</div>'}
      </article>
    `;
  }

  function renderScheduleTeamStats() {
    const ranked = [...scheduleStats].sort((a, b) => {
      return Number(b.scheduleUpvotes || 0) - Number(a.scheduleUpvotes || 0)
        || Number(b.gamesPlayed || 0) - Number(a.gamesPlayed || 0)
        || String(a.name).localeCompare(String(b.name));
    });

    const rows = ranked.map((team, index) => [
      index + 1,
      teamLink(team.name),
      escapeHtml(team.conference || ''),
      escapeHtml(team.record || ''),
      fmt(team.scheduleUpvotes),
      team.gamesPlayed,
      fmt(team.averageUpvotes)
    ]);

    return `
      <article class="card">
        <h2 class="card-title">Team Schedule Upvotes</h2>
        <p class="muted">Team totals use scores from live and final games in the schedule.</p>
        ${table(['Rank', 'Team', 'Conf', 'Record', 'Schedule Upvotes', 'Games', 'Avg'], rows)}
      </article>
    `;
  }

  function renderTeamLeaders() {
    return `
      <article class="card">
        <h2 class="card-title">Team Game Log Leaders</h2>
        ${teams.map(team => {
          const teamPlayers = players.filter(player => player.team === team.name);
          const leader = [...teamPlayers].sort((a, b) => Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0))[0];

          return `
            <div class="row">
              <span>
                <strong>${teamLink(team.name)}</strong><br>
                <span class="muted">${escapeHtml(team.record || '')} · ${escapeHtml(team.conference || '')}</span>
              </span>
              <strong>${leader ? `${playerLink(leader.handle)} · ${fmt(leader.gameLogUpvotes)}` : 'None'}</strong>
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
      filtered.sort((a, b) => String(a.team).localeCompare(String(b.team)) || Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0));
    } else {
      filtered.sort((a, b) => Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0));
    }

    const rows = filtered.map((player, index) => {
      const previous = getPreviousTeam(data, player.handle);

      return [
        index + 1,
        playerLink(player.handle),
        teamLink(player.team),
        escapeHtml(player.conference || ''),
        fmt(player.gameLogUpvotes),
        player.liveGames ? 'Live now' : 'No',
        previous ? escapeHtml(previous) : 'None'
      ];
    });

    const tableTarget = $('#playersTable');
    if (tableTarget) {
      tableTarget.innerHTML = `<h2 class="card-title">All Players</h2>` + table(['Rank', 'Player', 'Team', 'Conf', 'Game Log Upvotes', 'Live', 'Previous Team'], rows);
    }
  }

  function renderRecords() {
    const eastPlayers = byGameLogUpvotes.filter(player => String(player.conference).toLowerCase() === 'east');
    const westPlayers = byGameLogUpvotes.filter(player => String(player.conference).toLowerCase() === 'west');
    const livePlayers = byGameLogUpvotes.filter(player => player.liveGames);

    const recordsTarget = $('#recordsGrid');
    if (!recordsTarget) return;

    recordsTarget.innerHTML = `
      ${renderScheduleTeamStats()}
      ${livePlayers.length ? renderPlayerList('Live Player Game Log Upvotes', livePlayers, 12) : ''}
      ${renderPlayerList('Top 10 Game Log Upvotes', byGameLogUpvotes, 10)}
      ${renderPlayerList('East Game Log Leaders', eastPlayers, 8)}
      ${renderPlayerList('West Game Log Leaders', westPlayers, 8)}
      ${renderTeamLeaders()}
    `;
  }

  const leadersTarget = $('#leaders');
  if (leadersTarget) {
    const totalPlayers = players.length;
    const totalGameLogUpvotes = players.reduce((sum, player) => sum + Number(player.gameLogUpvotes || 0), 0);
    const livePlayers = players.filter(player => player.liveGames).length;
    const topPlayer = byGameLogUpvotes[0];
    const topScheduleTeam = [...scheduleStats].sort((a, b) => Number(b.scheduleUpvotes || 0) - Number(a.scheduleUpvotes || 0))[0];

    leadersTarget.innerHTML = `
      ${renderStatCard('Top Player', topPlayer ? `@${escapeHtml(cleanHandle(topPlayer.handle))}` : 'None', topPlayer ? `${fmt(topPlayer.gameLogUpvotes)} game log upvotes · ${topPlayer.team}` : '')}
      ${renderStatCard('Top Schedule Team', topScheduleTeam ? escapeHtml(topScheduleTeam.name) : 'None', topScheduleTeam ? `${fmt(topScheduleTeam.scheduleUpvotes)} schedule upvotes` : '')}
      ${renderStatCard('Current Players', totalPlayers, 'Players on current rosters')}
      ${renderStatCard('Total Game Log Upvotes', fmt(totalGameLogUpvotes), 'All player box score upvotes')}
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

function getCurrentPlayersWithGameLogTotals(data) {
  return (data.teams || []).flatMap(team => {
    return (team.roster || []).map(player => {
      const handle = cleanHandle(player.handle);
      const log = getPlayerGameLog(data, handle);
      const gameLogUpvotes = log.reduce((sum, game) => sum + Number(game.upvotes || 0), 0);
      const liveGames = log.filter(game => game.status === 'Live').length;

      return {
        ...player,
        handle,
        team: team.name,
        conference: team.conference,
        gameLogUpvotes,
        liveGames
      };
    });
  });
}

function getPlayerGameLog(data, handle) {
  const target = cleanHandle(handle).toLowerCase();
  const log = [];

  (data.games || []).forEach(game => {
    if (!game.boxScore) return;

    const teamAPlayers = game.boxScore.teamA || [];
    const teamBPlayers = game.boxScore.teamB || [];

    const teamAPlayer = teamAPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);
    const teamBPlayer = teamBPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);

    if (!teamAPlayer && !teamBPlayer) return;

    const entry = teamAPlayer || teamBPlayer;

    log.push({
      status: getGameStatus(game),
      upvotes: Number(entry.upvotes || 0),
      week: game.week || ''
    });
  });

  return log;
}

function getPreviousTeam(data, handle) {
  const key = cleanHandle(handle);
  const history = data.playerHistory?.[key];
  if (!history || !history.length) return '';
  return history[0]?.from || '';
}

function getGameStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function getScheduleTeamStats(data) {
  const teams = data.teams || [];
  const stats = {};

  teams.forEach(team => {
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
    const aScore = Number(game.teamAScore || 0);
    const bScore = Number(game.teamBScore || 0);

    if (status !== 'Final' && status !== 'Live') return;

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
