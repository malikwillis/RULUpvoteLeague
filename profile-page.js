loadLeagueData().then(data => {
  pageHeader(data, 'profile.html', 'Player', 'Profile', 'Current team, upvotes, previous teams, trade history, and game log');
  pageFooter(data);

  const root = $('#profileRoot') || $('#profileContent') || document.querySelector('main') || document.body;
  const raw = cleanHandle(new URLSearchParams(location.search).get('player') || '');

  const players = allPlayers(data).map(player => ({
    ...player,
    handle: cleanHandle(player.handle)
  }));

  if (!raw) {
    renderPlayerDirectory(root, data, players);
    return;
  }

  const player = players.find(p => cleanHandle(p.handle).toLowerCase() === raw.toLowerCase());

  if (!player) {
    root.innerHTML = `
      <section class="card">
        <h2>Player not found</h2>
        <p class="muted">That player is not in the current RUL data file.</p>
        <a class="btn" href="profile.html">View All Players</a>
      </section>
    `;
    return;
  }

  renderPlayerProfile(root, data, player, players);
}).catch(error => {
  console.error('Profile page failed:', error);
  const root = document.querySelector('#profileRoot') || document.querySelector('main') || document.body;
  root.innerHTML = `
    <section class="card">
      <h2>Profile failed to load</h2>
      <p class="muted">Check that static-data.js, utils.js, data-service.js, layout.js, and profile-page.js are uploaded in the main repo folder.</p>
    </section>
  `;
});

function renderPlayerDirectory(root, data, players) {
  const sorted = [...players].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0));

  root.innerHTML = `
    <section class="card">
      <h2 class="card-title">Player Directory</h2>
      <p class="muted">Tap any player to open their profile.</p>
      <input class="search" id="profileSearch" placeholder="Search player or team">
      <div id="profileDirectory"></div>
    </section>
  `;

  function draw() {
    const term = normalize($('#profileSearch')?.value || '');
    const filtered = sorted.filter(player => {
      if (!term) return true;
      return normalize(player.handle).includes(term)
        || normalize(player.team).includes(term)
        || normalize(player.conference).includes(term);
    });

    $('#profileDirectory').innerHTML = filtered.map((player, index) => `
      <a class="row" href="profile.html?player=${slug('@' + cleanHandle(player.handle))}">
        <span>
          <strong>${index + 1}. @${escapeHtml(cleanHandle(player.handle))}</strong><br>
          <span class="muted">${escapeHtml(player.team)} · ${escapeHtml(player.conference || '')}</span>
        </span>
        <strong>${fmt(player.upvotes)}</strong>
      </a>
    `).join('') || '<div class="empty">No players found.</div>';
  }

  $('#profileSearch').addEventListener('input', draw);
  draw();
}

function renderPlayerProfile(root, data, player, players) {
  const team = data.teams.find(t => t.name === player.team);
  const ranked = [...players].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0));
  const rank = ranked.findIndex(p => cleanHandle(p.handle) === cleanHandle(player.handle)) + 1;

  const history = data.playerHistory?.[cleanHandle(player.handle)] || player.history || [];
  const previousTeams = [...new Set(history.map(h => h.from).filter(Boolean))];

  const movementLabel = previousTeams.length
    ? `${previousTeams.join(' → ')} → ${player.team}`
    : 'No previous RUL team listed';

  const officialTotal = Number(team?.totalUpvotes || 0);
  const teamShare = officialTotal
    ? Math.round((Number(player.upvotes || 0) / officialTotal) * 100)
    : 0;

  const gameLog = getPlayerGameLog(data, player.handle);
  const loggedGames = gameLog.length;
  const loggedUpvotes = gameLog.reduce((sum, game) => sum + Number(game.upvotes || 0), 0);
  const averageUpvotes = loggedGames ? Math.round(loggedUpvotes / loggedGames) : 0;
  const bestGame = gameLog.length
    ? [...gameLog].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0]
    : null;

  root.innerHTML = `
    <section class="profile-hero card">
      <div class="avatar">${escapeHtml(cleanHandle(player.handle).slice(0, 1).toUpperCase())}</div>
      <div>
        <div class="label">RUL Player Profile</div>
        <h1 class="profile-name">@${escapeHtml(cleanHandle(player.handle))}</h1>
        <p class="muted">Current Team: ${teamLink(player.team)} · ${fmt(player.upvotes)} upvotes</p>
      </div>
    </section>

    <section class="grid four">
      <article class="card">
        <div class="label">Current Team</div>
        <div class="kpi">${escapeHtml(player.team)}</div>
      </article>
      <article class="card">
        <div class="label">Previous Team</div>
        <div class="kpi">${previousTeams.length ? escapeHtml(previousTeams[previousTeams.length - 1]) : 'None'}</div>
      </article>
      <article class="card">
        <div class="label">Upvotes</div>
        <div class="kpi">${fmt(player.upvotes)}</div>
      </article>
      <article class="card">
        <div class="label">League Rank</div>
        <div class="kpi">#${rank}</div>
      </article>
    </section>

    <section class="grid four">
      <article class="card">
        <div class="label">Logged Games</div>
        <div class="kpi">${fmt(loggedGames)}</div>
      </article>
      <article class="card">
        <div class="label">Game Log Upvotes</div>
        <div class="kpi">${fmt(loggedUpvotes)}</div>
      </article>
      <article class="card">
        <div class="label">Average</div>
        <div class="kpi">${fmt(averageUpvotes)}</div>
      </article>
      <article class="card">
        <div class="label">Best Game</div>
        <div class="kpi">${bestGame ? fmt(bestGame.upvotes) : '0'}</div>
        <p class="muted">${bestGame ? escapeHtml(bestGame.week + ' vs ' + bestGame.opponent) : 'No games logged'}</p>
      </article>
    </section>

    <section class="grid two">
      <article class="card">
        <h2>Team Movement</h2>
        <div class="row">
          <span>Path</span>
          <strong>${escapeHtml(movementLabel)}</strong>
        </div>
        <div class="row">
          <span>Team Share</span>
          <strong>${teamShare}% of ${escapeHtml(player.team)} official total</strong>
        </div>
        <p class="note">Official team totals stay locked to the standings total. Traded player upvotes do not move backward into the new team total.</p>
      </article>

      <article class="card">
        <h2>Transaction History</h2>
        ${history.length ? history.map(h => `
          <div class="row">
            <span>
              <strong>${escapeHtml(h.week || h.date || 'Recent')}</strong><br>
              <span class="muted">${escapeHtml(h.title || 'Trade')}</span>
            </span>
            <strong>${escapeHtml(h.from || '')} → ${escapeHtml(h.to || '')}</strong>
          </div>
        `).join('') : '<div class="empty">No trade history listed.</div>'}
      </article>
    </section>

    <section class="card">
      <h2>Game Log</h2>
      ${renderGameLog(gameLog)}
    </section>

    <section class="card">
      <a class="btn" href="profile.html">View All Players</a>
      <a class="btn" href="${teamUrl(player.team)}">View Team</a>
      <a class="btn" href="live.html">View Scores</a>
    </section>
  `;
}

function getPlayerGameLog(data, handle) {
  const target = cleanHandle(handle).toLowerCase();
  const games = data.games || [];

  const log = [];

  games.forEach(game => {
    if (!game.boxScore) return;

    const teamAPlayers = game.boxScore.teamA || [];
    const teamBPlayers = game.boxScore.teamB || [];

    const teamAPlayer = teamAPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);
    const teamBPlayer = teamBPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);

    if (!teamAPlayer && !teamBPlayer) return;

    const side = teamAPlayer ? 'teamA' : 'teamB';
    const entry = teamAPlayer || teamBPlayer;

    const playerTeam = side === 'teamA' ? game.teamA : game.teamB;
    const opponent = side === 'teamA' ? game.teamB : game.teamA;
    const teamScore = side === 'teamA' ? Number(game.teamAScore || 0) : Number(game.teamBScore || 0);
    const opponentScore = side === 'teamA' ? Number(game.teamBScore || 0) : Number(game.teamAScore || 0);

    let result = 'T';
    if (teamScore > opponentScore) result = 'W';
    if (teamScore < opponentScore) result = 'L';

    log.push({
      week: game.week || '',
      date: game.date || '',
      type: game.type || '',
      team: playerTeam,
      opponent,
      result,
      teamScore,
      opponentScore,
      upvotes: Number(entry.upvotes || 0),
      note: entry.note || '',
      gameNote: game.boxScore.note || game.note || ''
    });
  });

  return log.sort((a, b) => weekNumber(a.week) - weekNumber(b.week));
}

function weekNumber(week) {
  const match = String(week || '').match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function renderGameLog(log) {
  if (!log.length) {
    return '<div class="empty">No game log has been entered for this player yet.</div>';
  }

  const rows = log.map(game => [
    escapeHtml(game.week),
    escapeHtml(game.date),
    teamLink(game.team),
    escapeHtml(game.result),
    escapeHtml(game.opponent),
    `${fmt(game.teamScore)} to ${fmt(game.opponentScore)}`,
    fmt(game.upvotes),
    game.note ? escapeHtml(game.note) : ''
  ]);

  return `
    ${table(['Week', 'Date', 'Team', 'Result', 'Opponent', 'Score', 'Upvotes', 'Note'], rows)}
    <p class="note">Game log only includes games where player box scores were entered in static-data.js.</p>
  `;
}
