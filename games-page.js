loadLeagueData().then(originalData => {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  const data = saved ? JSON.parse(saved) : originalData;

  pageHeader(data, 'games.html', 'Game', 'Center', 'Browse every matchup and open full game pages');
  pageFooter(data);

  const root = $('#gamesRoot') || document.querySelector('main') || document.body;
  let currentWeek = '';
  let currentStatus = '';

  const weeks = [...new Set((data.games || []).map(game => game.week).filter(Boolean))]
    .sort((a, b) => weekNumber(a) - weekNumber(b));

  root.innerHTML = `
    <section class="card">
      <div class="row">
        <span>
          <h2 class="card-title">RUL Game Center</h2>
          <p class="muted">Open any matchup for full score, box score, top player, game notes, and matchup breakdown.</p>
        </span>
        <span class="pill">${fmt((data.games || []).length)} Games</span>
      </div>

      <div class="game-filter-row" style="margin-top:14px">
        <select id="weekFilter">
          <option value="">All weeks</option>
          ${weeks.map(week => `<option value="${escapeHtml(week)}">${escapeHtml(week)}</option>`).join('')}
        </select>

        <select id="statusFilter">
          <option value="">All statuses</option>
          <option value="Live">Live</option>
          <option value="Upcoming">Upcoming</option>
          <option value="Final">Final</option>
        </select>
      </div>
    </section>

    <section id="gamesList" class="game-two-grid" style="margin-top:16px"></section>
  `;

  $('#weekFilter')?.addEventListener('change', event => {
    currentWeek = event.target.value || '';
    renderGames();
  });

  $('#statusFilter')?.addEventListener('change', event => {
    currentStatus = event.target.value || '';
    renderGames();
  });

  renderGames();

  function renderGames() {
    let games = data.games || [];

    games = games.filter(game => {
      const matchesWeek = !currentWeek || game.week === currentWeek;
      const matchesStatus = !currentStatus || gameStatus(game) === currentStatus;
      return matchesWeek && matchesStatus;
    });

    games = [...games].sort((a, b) => weekNumber(a.week) - weekNumber(b.week));

    $('#gamesList').innerHTML = games.length ? games.map(renderGameCard).join('') : `
      <article class="card">
        <h2>No games found</h2>
        <p class="muted">Change the filters and try again.</p>
      </article>
    `;
  }
}).catch(error => {
  console.error('Games page failed:', error);
  const root = $('#gamesRoot') || document.querySelector('main') || document.body;
  root.innerHTML = `
    <section class="card">
      <h2>Games page failed to load</h2>
      <p class="muted">${escapeHtml(error.message || 'Check games-page.js and static-data.js.')}</p>
    </section>
  `;
});

function renderGameCard(game) {
  const status = gameStatus(game);
  const a = Number(game.teamAScore || 0);
  const b = Number(game.teamBScore || 0);
  const winner = getWinner(game);
  const margin = Math.abs(a - b);
  const top = topPlayerInGame(game);

  return `
    <a class="card game-card-link" href="${gameUrl(game)}">
      <div class="row">
        <span>
          <strong>${escapeHtml(game.teamA)} vs ${escapeHtml(game.teamB)}</strong><br>
          <span class="muted">${escapeHtml(game.week || '')} · ${escapeHtml(game.date || '')} · ${escapeHtml(game.type || '')}</span>
        </span>
        <span class="pill">${escapeHtml(status)}</span>
      </div>

      <div class="score-strip" style="margin-top:14px">
        <span>
          <strong>${escapeHtml(game.teamA)}</strong><br>
          <span class="game-mini-score">${fmt(a)}</span>
        </span>

        <span class="muted">${winner ? `${escapeHtml(winner)} by ${fmt(margin)}` : status === 'Upcoming' ? 'Not played' : 'Tied'}</span>

        <span style="text-align:right">
          <strong>${escapeHtml(game.teamB)}</strong><br>
          <span class="game-mini-score">${fmt(b)}</span>
        </span>
      </div>

      ${top ? `<p class="muted">Top player: @${escapeHtml(cleanHandle(top.handle))} · ${fmt(top.upvotes)}</p>` : '<p class="muted">No box score entered yet.</p>'}
    </a>
  `;
}

function gameUrl(game) {
  return `game.html?week=${encodeURIComponent(game.week || '')}&teamA=${encodeURIComponent(game.teamA || '')}&teamB=${encodeURIComponent(game.teamB || '')}`;
}

function gameStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function getWinner(game) {
  if (gameStatus(game) !== 'Final' && gameStatus(game) !== 'Live') return null;
  const a = Number(game.teamAScore || 0);
  const b = Number(game.teamBScore || 0);
  if (a === b) return null;
  return a > b ? game.teamA : game.teamB;
}

function topPlayerInGame(game) {
  const players = [
    ...(game.boxScore?.teamA || []),
    ...(game.boxScore?.teamB || [])
  ];

  if (!players.length) return null;

  return players
    .map(player => ({ ...player, handle: cleanHandle(player.handle), upvotes: Number(player.upvotes || 0) }))
    .sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0];
}

function weekNumber(week) {
  const match = String(week || '').match(/\d+/);
  return match ? Number(match[0]) : 999;
}
