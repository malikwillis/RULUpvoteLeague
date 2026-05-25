loadLeagueData().then(originalData => {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  const data = saved ? JSON.parse(saved) : originalData;

  pageHeader(data, 'index.html', 'League Central', 'RUL Central', 'The official RUL command center');
  pageFooter(data);

  const root = $('#homeRoot') || document.body;
  const teams = data.teams || [];
  const games = data.games || [];
  const players = buildHomePlayers(data);
  const scheduleStats = buildHomeTeamStats(data);
  const liveGames = games.filter(game => homeGameStatus(game) === 'Live');
  const finalGames = games.filter(game => homeGameStatus(game) === 'Final');
  const upcomingGames = games.filter(game => homeGameStatus(game) === 'Upcoming');
  const recentFinals = [...finalGames].sort((a, b) => weekNumber(b.week) - weekNumber(a.week)).slice(0, 5);
  const nextGames = [...upcomingGames].sort((a, b) => weekNumber(a.week) - weekNumber(b.week)).slice(0, 5);
  const topPlayers = [...players].sort((a, b) => Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0)).slice(0, 8);
  const hottestTeams = [...scheduleStats].sort((a, b) => Number(b.scheduleUpvotes || 0) - Number(a.scheduleUpvotes || 0)).slice(0, 6);
  const topPlayer = topPlayers[0];
  const liveOrNext = liveGames.length ? liveGames : nextGames;
  const totalScheduleUpvotes = scheduleStats.reduce((sum, team) => sum + Number(team.scheduleUpvotes || 0), 0);

  root.innerHTML = `
    <section class="card central-hero">
      <div class="hero-grid">
        <div>
          <div class="label">${escapeHtml(data.league?.portalLabel || 'Upvote League Portal')}</div>
          <h1 class="hero-title">${escapeHtml(data.league?.name || 'Real Upvote League')}</h1>
          <p class="muted hero-subtitle">Live scores, standings, rosters, transactions, player profiles, game logs, and league stats in one central hub.</p>

          <div class="home-actions">
            <a class="btn" href="live.html">Live Scores</a>
            <a class="btn" href="games.html">Games</a>
            <a class="btn" href="standings.html">Standings</a>
            <a class="btn" href="roster.html">Rosters</a>
            <a class="btn" href="stats.html">Stats</a>
            <a class="btn" href="transactions.html">Transactions</a>
          </div>
        </div>

        <div class="mini-card">
          <div class="label">League Status</div>
          <div class="kpi">${escapeHtml(data.league?.updatedLabel || 'Updated')}</div>
          <div class="row"><span>Teams</span><strong>${fmt(teams.length)}</strong></div>
          <div class="row"><span>Live Games</span><strong>${fmt(liveGames.length)}</strong></div>
          <div class="row"><span>Final Games</span><strong>${fmt(finalGames.length)}</strong></div>
          <div class="row"><span>Upcoming Games</span><strong>${fmt(upcomingGames.length)}</strong></div>
        </div>
      </div>
    </section>

    <section class="home-section home-mini-grid">
      ${statCard('Top Player', topPlayer ? `@${escapeHtml(cleanHandle(topPlayer.handle))}` : 'None', topPlayer ? `${fmt(topPlayer.gameLogUpvotes)} game log upvotes` : 'No logs yet')}
      ${statCard('Top Team', hottestTeams[0] ? escapeHtml(hottestTeams[0].name) : 'None', hottestTeams[0] ? `${fmt(hottestTeams[0].scheduleUpvotes)} schedule upvotes` : 'No scores yet')}
      ${statCard('Total Upvotes', fmt(totalScheduleUpvotes), 'Schedule based team total')}
      ${statCard('Current Week', escapeHtml(getCurrentWeek(games)), liveGames.length ? 'Live action now' : 'Next games loaded')}
    </section>

    <section class="home-section">
      <div class="home-section-title">
        <h2 class="card-title">Game Center</h2>
        <a class="btn" href="games.html">Open Game Center</a>
      </div>
      <div class="home-two-grid">
        <article class="card">
          <h2>${liveGames.length ? 'Live Now' : 'Next Up'}</h2>
          ${liveOrNext.length ? liveOrNext.map(renderGameCard).join('') : '<div class="empty">No live or upcoming games listed.</div>'}
        </article>

        <article class="card">
          <h2>Recent Finals</h2>
          ${recentFinals.length ? recentFinals.map(renderFinalCard).join('') : '<div class="empty">No finals yet.</div>'}
        </article>
      </div>
    </section>

    <section class="home-section home-two-grid">
      <article class="card">
        <div class="home-section-title">
          <h2 class="card-title">League Leaders</h2>
          <a class="btn" href="stats.html">Full Stats</a>
        </div>
        ${topPlayers.length ? topPlayers.map((player, index) => `
          <div class="trend-row">
            <span class="rank-badge">${index + 1}</span>
            <span>
              <strong>${playerLink(player.handle)}</strong><br>
              <span class="muted">${teamLink(player.team)} · ${escapeHtml(player.conference || '')}</span>
            </span>
            <strong>${fmt(player.gameLogUpvotes)}</strong>
          </div>
        `).join('') : '<div class="empty">No player stats yet.</div>'}
      </article>

      <article class="card">
        <div class="home-section-title">
          <h2 class="card-title">Team Upvote Board</h2>
          <a class="btn" href="standings.html">Standings</a>
        </div>
        ${hottestTeams.length ? hottestTeams.map((team, index) => `
          <div class="trend-row">
            <span class="rank-badge">${index + 1}</span>
            <span>
              <strong>${teamLink(team.name)}</strong><br>
              <span class="muted">${escapeHtml(team.conference || '')} · ${escapeHtml(team.record || '')} · ${team.gamesPlayed} games</span>
            </span>
            <strong>${fmt(team.scheduleUpvotes)}</strong>
          </div>
        `).join('') : '<div class="empty">No team scores yet.</div>'}
      </article>
    </section>

    <section class="home-section home-three-grid">
      <a class="card quick-link-card" href="profile.html">
        <div class="label">Players</div>
        <h2>Player Directory</h2>
        <p class="muted">Search profiles, game logs, previous teams, and live game status.</p>
      </a>

      <a class="card quick-link-card" href="transactions.html">
        <div class="label">Movement</div>
        <h2>Trade Center</h2>
        <p class="muted">Track trades, signings, pick movement, and player history.</p>
      </a>

      <a class="card quick-link-card" href="score-entry.html">
        <div class="label">Commissioner</div>
        <h2>Score Entry</h2>
        <p class="muted">Update live games, final scores, lineups, and box scores.</p>
      </a>
    </section>

    <section class="home-section home-two-grid">
      <article class="card">
        <h2 class="card-title">Conference Snapshot</h2>
        <div class="home-two-grid">
          ${renderConference('East', teams)}
          ${renderConference('West', teams)}
        </div>
      </article>

      <article class="card">
        <h2 class="card-title">Latest League Moves</h2>
        ${renderTransactions(data)}
      </article>
    </section>
  `;
}).catch(error => {
  console.error('Home page failed:', error);
  const root = $('#homeRoot') || document.body;
  root.innerHTML = `
    <section class="card">
      <h2>Home page failed to load</h2>
      <p class="muted">${escapeHtml(error.message || 'Check that all site files are uploaded.')}</p>
    </section>
  `;
});

function statCard(label, value, subtext) {
  return `
    <article class="card">
      <div class="label">${escapeHtml(label)}</div>
      <div class="kpi">${value}</div>
      <p class="muted">${escapeHtml(subtext || '')}</p>
    </article>
  `;
}

function homeGameStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function weekNumber(week) {
  const match = String(week || '').match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function getCurrentWeek(games) {
  const live = games.find(game => homeGameStatus(game) === 'Live');
  if (live) return live.week || 'Live';
  const upcoming = games.find(game => homeGameStatus(game) === 'Upcoming');
  if (upcoming) return upcoming.week || 'Upcoming';
  const finals = games.filter(game => homeGameStatus(game) === 'Final').sort((a, b) => weekNumber(b.week) - weekNumber(a.week));
  return finals[0]?.week || 'Season';
}

function renderGameCard(game) {
  const status = homeGameStatus(game);
  const aScore = Number(game.teamAScore || 0);
  const bScore = Number(game.teamBScore || 0);
  const leader = aScore === bScore ? 'Tied' : aScore > bScore ? game.teamA : game.teamB;
  const margin = Math.abs(aScore - bScore);

  return `
    <div class="home-feed-card">
      <div class="score-strip">
        <div>
          <strong>${teamLink(game.teamA)}</strong>
          <div class="score-num">${fmt(aScore)}</div>
        </div>
        <div class="vs-chip">
          <span class="pill">${escapeHtml(status)}</span>
          <div class="muted">${status === 'Upcoming' ? 'Not started' : `${escapeHtml(leader)} by ${fmt(margin)}`}</div>
        </div>
        <div class="right">
          <strong>${teamLink(game.teamB)}</strong>
          <div class="score-num">${fmt(bScore)}</div>
        </div>
      </div>
      <p class="muted">${escapeHtml(game.week || '')} · ${escapeHtml(game.date || '')} · ${escapeHtml(game.type || '')}</p>
    </div>
  `;
}

function renderFinalCard(game) {
  const aScore = Number(game.teamAScore || 0);
  const bScore = Number(game.teamBScore || 0);
  const winnerName = aScore > bScore ? game.teamA : bScore > aScore ? game.teamB : 'Tie';
  const margin = Math.abs(aScore - bScore);
  const top = topPlayerInGame(game);

  return `
    <div class="home-feed-card">
      <div class="row">
        <span>
          <strong>${teamLink(game.teamA)} ${fmt(aScore)} · ${teamLink(game.teamB)} ${fmt(bScore)}</strong><br>
          <span class="muted">${escapeHtml(game.week || '')} · ${escapeHtml(winnerName)} by ${fmt(margin)}</span>
        </span>
        <span class="pill">Final</span>
      </div>
      ${top ? `<p class="muted">Top player: ${playerLink(top.handle)} · ${fmt(top.upvotes)}</p>` : ''}
    </div>
  `;
}

function topPlayerInGame(game) {
  const players = [
    ...(game.boxScore?.teamA || []),
    ...(game.boxScore?.teamB || [])
  ];

  if (!players.length) return null;
  return players.sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0];
}

function buildHomePlayers(data) {
  const teams = data.teams || [];

  return teams.flatMap(team => {
    return (team.roster || []).map(player => {
      const handle = cleanHandle(player.handle);
      const log = playerGameLog(data, handle);
      const gameLogUpvotes = log.reduce((sum, item) => sum + Number(item.upvotes || 0), 0);

      return {
        handle,
        team: team.name,
        conference: team.conference || '',
        gameLogUpvotes,
        liveNow: log.some(item => item.status === 'Live')
      };
    });
  });
}

function playerGameLog(data, handle) {
  const target = cleanHandle(handle).toLowerCase();
  const log = [];

  (data.games || []).forEach(game => {
    if (!game.boxScore) return;
    const status = homeGameStatus(game);
    if (status !== 'Final' && status !== 'Live') return;

    const all = [
      ...(game.boxScore.teamA || []),
      ...(game.boxScore.teamB || [])
    ];

    const entry = all.find(player => cleanHandle(player.handle).toLowerCase() === target);
    if (!entry) return;

    log.push({
      week: game.week || '',
      status,
      upvotes: Number(entry.upvotes || 0)
    });
  });

  return log;
}

function buildHomeTeamStats(data) {
  const stats = {};

  (data.teams || []).forEach(team => {
    stats[team.name] = {
      name: team.name,
      conference: team.conference || '',
      record: team.record || '',
      conferenceRecord: team.conferenceRecord || '',
      scheduleUpvotes: 0,
      gamesPlayed: 0
    };
  });

  (data.games || []).forEach(game => {
    const status = homeGameStatus(game);
    if (status !== 'Final' && status !== 'Live') return;

    if (stats[game.teamA]) {
      stats[game.teamA].scheduleUpvotes += Number(game.teamAScore || 0);
      stats[game.teamA].gamesPlayed += 1;
    }

    if (stats[game.teamB]) {
      stats[game.teamB].scheduleUpvotes += Number(game.teamBScore || 0);
      stats[game.teamB].gamesPlayed += 1;
    }
  });

  return Object.values(stats);
}

function renderConference(conference, teams) {
  const ranked = teams
    .filter(team => String(team.conference || '').toLowerCase() === conference.toLowerCase())
    .sort((a, b) => {
      const ar = parseRecord(a.record);
      const br = parseRecord(b.record);
      return br.wins - ar.wins || ar.losses - br.losses || String(a.name).localeCompare(String(b.name));
    })
    .slice(0, 4);

  return `
    <div class="mini-card">
      <div class="label">${escapeHtml(conference)}</div>
      ${ranked.map((team, index) => `
        <div class="row">
          <span>${index + 1}. ${teamLink(team.name)}</span>
          <strong>${escapeHtml(team.record || '')}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTransactions(data) {
  const transactions = (data.transactions || []).slice(0, 6);

  if (!transactions.length) {
    return '<div class="empty">No transactions listed.</div>';
  }

  return transactions.map(item => `
    <div class="home-feed-card">
      <div class="row">
        <span>
          <strong>${escapeHtml(item.title || item.type || 'Transaction')}</strong><br>
          <span class="muted">${escapeHtml(item.week || item.date || '')} · ${escapeHtml(item.type || '')}</span>
        </span>
        <span class="pill">Move</span>
      </div>
      ${item.description ? `<p class="muted">${escapeHtml(item.description)}</p>` : ''}
    </div>
  `).join('');
}
