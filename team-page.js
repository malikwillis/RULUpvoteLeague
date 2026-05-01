
function loadCurrentData(originalData) {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  return saved ? JSON.parse(saved) : originalData;
}

function gameStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function playerGameLog(data, handle) {
  const target = cleanHandle(handle).toLowerCase();
  const log = [];

  (data.games || []).forEach(game => {
    if (!game.boxScore) return;

    const teamAPlayers = game.boxScore.teamA || [];
    const teamBPlayers = game.boxScore.teamB || [];

    const a = teamAPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);
    const b = teamBPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);

    if (!a && !b) return;

    const side = a ? 'teamA' : 'teamB';
    const entry = a || b;
    const team = side === 'teamA' ? game.teamA : game.teamB;
    const opponent = side === 'teamA' ? game.teamB : game.teamA;
    const teamScore = side === 'teamA' ? Number(game.teamAScore || 0) : Number(game.teamBScore || 0);
    const opponentScore = side === 'teamA' ? Number(game.teamBScore || 0) : Number(game.teamAScore || 0);
    const status = gameStatus(game);

    log.push({
      week: game.week || '',
      date: game.date || '',
      status,
      team,
      opponent,
      teamScore,
      opponentScore,
      upvotes: Number(entry.upvotes || 0),
      note: entry.note || ''
    });
  });

  return log;
}

function playerGameTotal(data, handle) {
  return playerGameLog(data, handle).reduce((sum, game) => sum + Number(game.upvotes || 0), 0);
}

function playerLiveGame(data, handle) {
  return playerGameLog(data, handle).find(game => game.status === 'Live') || null;
}

function scheduleTeamStats(data) {
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
    const status = gameStatus(game);
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

function teamScheduleStat(data, teamName) {
  return scheduleTeamStats(data).find(team => team.name === teamName) || {
    scheduleUpvotes: 0,
    gamesPlayed: 0,
    averageUpvotes: 0
  };
}

function gameCard(game) {
  const status = gameStatus(game);
  const aScore = Number(game.teamAScore || 0);
  const bScore = Number(game.teamBScore || 0);
  const leader = aScore === bScore ? 'Tied' : aScore > bScore ? game.teamA : game.teamB;
  const margin = Math.abs(aScore - bScore);

  return `
    <div class="live-row-item">
      <div class="live-matchup">
        <div>
          <div class="team-name">${teamLink(game.teamA)}</div>
          <div class="team-score">${fmt(aScore)}</div>
        </div>
        <div>
          <div class="vs">VS</div>
          <div class="diff">${status === 'Upcoming' ? 'Upcoming' : `${escapeHtml(leader)} by ${fmt(margin)}`}</div>
        </div>
        <div style="text-align:right">
          <div class="team-name">${teamLink(game.teamB)}</div>
          <div class="team-score">${fmt(bScore)}</div>
        </div>
      </div>
      <div class="projection">
        <div class="proj-label">${escapeHtml(status)} • ${escapeHtml(game.week)} • ${escapeHtml(game.date || '')} • ${escapeHtml(game.type || '')}</div>
      </div>
      <div class="mvp">${status === 'Live' ? 'LIVE NOW' : status === 'Final' ? 'FINAL' : 'MATCHUP NOT PLAYED YET'}</div>
    </div>
  `;
}

loadLeagueData().then(originalData => {
  const data = loadCurrentData(originalData);

  const params = new URLSearchParams(location.search);
  const requested = normalize(params.get('team') || 'Phantoms');
  const team = (data.teams || []).find(t => normalize(t.name) === requested || normalize(t.id) === requested) || (data.teams || [])[0];

  pageHeader(data, 'teams.html', team.name, '', 'Team Profile');
  pageFooter(data);

  if (!team) {
    $('#teamRoot').innerHTML = '<section class="card"><h2>Team not found</h2></section>';
    return;
  }

  const scheduleStats = teamScheduleStat(data, team.name);
  const roster = [...(team.roster || [])].map(player => ({
    ...player,
    handle: cleanHandle(player.handle),
    gameLogUpvotes: playerGameTotal(data, player.handle),
    liveGame: playerLiveGame(data, player.handle)
  })).sort((a, b) => Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0));

  const top = roster[0] || { handle: 'none', gameLogUpvotes: 0 };
  const games = (data.games || []).filter(game => game.teamA === team.name || game.teamB === team.name);

  $('#teamRoot').innerHTML = `
    <section class="grid four">
      <article class="card">
        <div class="label">Record</div>
        <div class="kpi">${escapeHtml(team.record || '0-0')}</div>
      </article>
      <article class="card">
        <div class="label">Conference</div>
        <div class="kpi">${escapeHtml(team.conference || '')}</div>
      </article>
      <article class="card">
        <div class="label">Schedule Upvotes</div>
        <div class="kpi">${fmt(scheduleStats.scheduleUpvotes)}</div>
        <p class="muted">${scheduleStats.gamesPlayed} games · ${fmt(scheduleStats.averageUpvotes)} avg</p>
      </article>
      <article class="card">
        <div class="label">Top Player</div>
        <div class="kpi">@${escapeHtml(cleanHandle(top.handle))}</div>
        <p class="muted">${fmt(top.gameLogUpvotes)} game log upvotes</p>
      </article>
    </section>

    <section class="grid two" style="margin-top:16px">
      <article class="card">
        <h2 class="card-title">Roster</h2>
        <p class="muted">Player numbers are game log upvotes only.</p>
        ${roster.map(player => `
          <div class="row">
            <span>
              ${playerLink(player.handle)}
              ${player.liveGame ? `<br><span class="muted">Live now vs ${escapeHtml(player.liveGame.opponent)}</span>` : ''}
            </span>
            <strong>${fmt(player.gameLogUpvotes)}</strong>
          </div>
        `).join('')}
      </article>

      <article class="card">
        <h2 class="card-title">Future Picks</h2>
        ${(data.futurePicks?.[team.name] || []).map(pick => `
          <div class="row">
            <span>${escapeHtml(pick)}</span>
            <span class="pill">Pick</span>
          </div>
        `).join('') || '<p class="muted">No picks listed.</p>'}
      </article>
    </section>

    <section class="card" style="margin-top:16px">
      <h2 class="card-title">Team Schedule</h2>
      <div class="live-list">${games.map(game => gameCard(game)).join('')}</div>
    </section>
  `;
}).catch(error => {
  console.error('Team page failed:', error);
  const root = $('#teamRoot') || document.body;
  root.innerHTML = `<section class="card"><h2>Team page failed to load</h2><p class="muted">${escapeHtml(error.message || 'Unknown error')}</p></section>`;
});
