
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

  pageHeader(data, 'roster.html', 'League', 'Roster', 'Players and Teams');
  pageFooter(data);

  const grid = $('#rosterGrid');
  const search = $('#search');

  if (!grid) {
    const main = document.querySelector('main') || document.body;
    main.innerHTML += '<section class="card"><h2>Roster container missing</h2></section>';
    return;
  }

  function teamLeader(team) {
    const roster = [...(team.roster || [])].map(player => ({
      ...player,
      handle: cleanHandle(player.handle),
      gameLogUpvotes: playerGameTotal(data, player.handle)
    })).sort((a, b) => Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0));

    return roster[0] || null;
  }

  function renderRoster(term = '') {
    const cleanTerm = normalize(term);

    const cards = (data.teams || []).map(team => {
      const scheduleStats = teamScheduleStat(data, team.name);
      const roster = [...(team.roster || [])].map(player => ({
        ...player,
        handle: cleanHandle(player.handle),
        gameLogUpvotes: playerGameTotal(data, player.handle),
        liveGame: playerLiveGame(data, player.handle)
      })).sort((a, b) => Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0));

      const filteredRoster = roster.filter(player => {
        if (!cleanTerm) return true;
        return normalize(player.handle).includes(cleanTerm)
          || normalize(team.name).includes(cleanTerm)
          || normalize(team.conference).includes(cleanTerm)
          || normalize(team.record).includes(cleanTerm);
      });

      const teamMatches = !cleanTerm
        || normalize(team.name).includes(cleanTerm)
        || normalize(team.conference).includes(cleanTerm)
        || normalize(team.record).includes(cleanTerm);

      if (!teamMatches && filteredRoster.length === 0) return '';

      const leader = teamLeader(team);
      const displayRoster = cleanTerm ? filteredRoster : roster;

      return `
        <article class="card roster-card">
          <div class="roster-head">
            <div>
              <div class="label">${escapeHtml(team.conference || 'Conference')}</div>
              <h2 class="card-title">${teamLink(team.name)}</h2>
              <p class="muted">${escapeHtml(team.record || '0-0')} record · ${escapeHtml(team.conferenceRecord || '0-0')} conf</p>
            </div>
            <span class="pill">${displayRoster.length} Players</span>
          </div>

          <div class="mini-card">
            <div class="label">Schedule Upvotes</div>
            <div class="kpi">${fmt(scheduleStats.scheduleUpvotes)}</div>
            <p class="muted">${scheduleStats.gamesPlayed} games played · ${fmt(scheduleStats.averageUpvotes)} average</p>
          </div>

          <div class="mini-card">
            <div class="row">
              <span>Team Leader</span>
              <strong>${leader ? `${playerLink(leader.handle)} · ${fmt(leader.gameLogUpvotes)}` : 'None'}</strong>
            </div>
          </div>

          <div class="roster-list">
            ${displayRoster.map((player, index) => {
              const history = data.playerHistory?.[cleanHandle(player.handle)] || player.history || [];
              const previousTeam = history?.[0]?.from || player.previousTeam || '';

              return `
                <a class="row player-row" href="${playerUrl(player.handle)}">
                  <span>
                    <strong>${index + 1}. @${escapeHtml(cleanHandle(player.handle))}</strong>
                    ${player.liveGame ? `<br><span class="muted">Live now vs ${escapeHtml(player.liveGame.opponent)}</span>` : ''}
                    ${previousTeam ? `<br><span class="muted">Previous: ${escapeHtml(previousTeam)}</span>` : ''}
                  </span>
                  <strong>${fmt(player.gameLogUpvotes)}</strong>
                </a>
              `;
            }).join('')}
          </div>
        </article>
      `;
    }).join('');

    grid.innerHTML = cards || `
      <section class="card">
        <h2>No roster results found</h2>
        <p class="muted">Try searching a different player or team.</p>
      </section>
    `;
  }

  if (search) {
    search.addEventListener('input', event => renderRoster(event.target.value));
  }

  renderRoster();
}).catch(error => {
  console.error('Roster page failed:', error);
  const main = document.querySelector('main') || document.body;
  main.innerHTML = `
    <section class="card">
      <h2>Roster failed to load</h2>
      <p class="muted">${escapeHtml(error.message || 'Check that all roster files are uploaded.')}</p>
    </section>
  `;
});
