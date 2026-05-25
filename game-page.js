loadLeagueData().then(originalData => {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  const data = saved ? JSON.parse(saved) : originalData;

  pageHeader(data, 'games.html', 'Game', 'Center', 'Full matchup pages, box scores, and game notes');
  pageFooter(data);

  const root = $('#gameRoot') || document.querySelector('main') || document.body;
  const game = findSelectedGame(data);

  if (!game) {
    root.innerHTML = `
      <section class="card">
        <h2>Game not found</h2>
        <p class="muted">Open the Game Center and select a matchup.</p>
        <a class="btn" href="games.html">Open Game Center</a>
      </section>
    `;
    return;
  }

  const status = gameStatus(game);
  const aScore = Number(game.teamAScore || 0);
  const bScore = Number(game.teamBScore || 0);
  const winner = getWinner(game);
  const margin = Math.abs(aScore - bScore);
  const box = normalizeBoxScore(game);
  const allPlayers = [...box.teamA, ...box.teamB];
  const topPlayer = allPlayers.sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0] || null;
  const lowPlayer = allPlayers.filter(p => Number(p.upvotes || 0) > 0).sort((a, b) => Number(a.upvotes || 0) - Number(b.upvotes || 0))[0] || null;
  const totalUpvotes = aScore + bScore;
  const averagePlayer = allPlayers.length ? Math.round(totalUpvotes / allPlayers.length) : 0;
  const aLeader = [...box.teamA].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0] || null;
  const bLeader = [...box.teamB].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0] || null;

  root.innerHTML = `
    <section class="card game-hero">
      <div class="row">
        <span>
          <div class="label">${escapeHtml(game.week || '')} · ${escapeHtml(game.date || '')} · ${escapeHtml(game.type || '')}</div>
          <h1 class="card-title">${escapeHtml(game.teamA)} vs ${escapeHtml(game.teamB)}</h1>
        </span>
        <span class="pill">${escapeHtml(status)}</span>
      </div>

      <div class="game-scoreboard">
        <div class="game-team">
          <div class="game-team-name">${teamLink(game.teamA)}</div>
          <div class="game-team-score">${fmt(aScore)}</div>
        </div>

        <div class="game-vs">
          <span class="pill">VS</span>
          <div class="muted">${winner ? `${escapeHtml(winner)} by ${fmt(margin)}` : status === 'Upcoming' ? 'Not played yet' : 'Tied'}</div>
        </div>

        <div class="game-team right">
          <div class="game-team-name">${teamLink(game.teamB)}</div>
          <div class="game-team-score">${fmt(bScore)}</div>
        </div>
      </div>

      ${game.note ? `<p class="muted">${escapeHtml(game.note)}</p>` : ''}
    </section>

    <section class="game-stat-grid" style="margin-top:16px">
      ${statCard('Top Player', topPlayer ? playerLink(topPlayer.handle) : 'None', topPlayer ? `${fmt(topPlayer.upvotes)} upvotes` : '')}
      ${statCard('Biggest Carry', topPlayer ? playerLink(topPlayer.handle) : 'None', topPlayer ? `${fmt(getPlayerShare(topPlayer, game))}% of team score` : '')}
      ${statCard('Lowest Scorer', lowPlayer ? playerLink(lowPlayer.handle) : 'None', lowPlayer ? `${fmt(lowPlayer.upvotes)} upvotes` : '')}
      ${statCard('Average Player', fmt(averagePlayer), 'Average score from logged players')}
    </section>

    <section class="game-two-grid" style="margin-top:16px">
      <article class="card">
        <h2 class="card-title">${escapeHtml(game.teamA)} Box Score</h2>
        ${renderTeamBox(box.teamA, aLeader)}
      </article>

      <article class="card">
        <h2 class="card-title">${escapeHtml(game.teamB)} Box Score</h2>
        ${renderTeamBox(box.teamB, bLeader)}
      </article>
    </section>

    <section class="game-two-grid" style="margin-top:16px">
      <article class="card">
        <h2 class="card-title">Game Breakdown</h2>
        <div class="row"><span>Status</span><strong>${escapeHtml(status)}</strong></div>
        <div class="row"><span>Winner</span><strong>${winner ? escapeHtml(winner) : 'None'}</strong></div>
        <div class="row"><span>Margin</span><strong>${fmt(margin)}</strong></div>
        <div class="row"><span>Total Upvotes</span><strong>${fmt(totalUpvotes)}</strong></div>
        <div class="row"><span>Logged Players</span><strong>${fmt(allPlayers.length)}</strong></div>
      </article>

      <article class="card">
        <h2 class="card-title">Team Leaders</h2>
        <div class="row">
          <span>${teamLink(game.teamA)}</span>
          <strong>${aLeader ? `${playerLink(aLeader.handle)} · ${fmt(aLeader.upvotes)}` : 'None'}</strong>
        </div>
        <div class="row">
          <span>${teamLink(game.teamB)}</span>
          <strong>${bLeader ? `${playerLink(bLeader.handle)} · ${fmt(bLeader.upvotes)}` : 'None'}</strong>
        </div>
      </article>
    </section>

    <section class="card" style="margin-top:16px">
      <h2 class="card-title">Game Log</h2>
      ${renderGameLog(game, box, winner, topPlayer)}
    </section>

    <section class="card" style="margin-top:16px">
      <h2 class="card-title">More Games</h2>
      <a class="btn" href="games.html">Open all games</a>
      <a class="btn" href="live.html">Live scoreboard</a>
      <a class="btn" href="standings.html">Standings</a>
    </section>
  `;
}).catch(error => {
  console.error('Game page failed:', error);
  const root = $('#gameRoot') || document.querySelector('main') || document.body;
  root.innerHTML = `
    <section class="card">
      <h2>Game page failed to load</h2>
      <p class="muted">${escapeHtml(error.message || 'Check game-page.js and static-data.js.')}</p>
    </section>
  `;
});

function findSelectedGame(data) {
  const params = new URLSearchParams(window.location.search);
  const week = params.get('week');
  const teamA = params.get('teamA');
  const teamB = params.get('teamB');

  const games = data.games || [];

  if (week && teamA && teamB) {
    return games.find(game =>
      String(game.week) === week &&
      String(game.teamA) === teamA &&
      String(game.teamB) === teamB
    ) || null;
  }

  return games.find(game => gameStatus(game) === 'Live')
    || games.find(game => gameStatus(game) === 'Upcoming')
    || [...games].reverse().find(game => gameStatus(game) === 'Final')
    || null;
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

function normalizeBoxScore(game) {
  return {
    teamA: (game.boxScore?.teamA || []).map(player => ({
      handle: cleanHandle(player.handle),
      upvotes: Number(player.upvotes || 0),
      note: player.note || ''
    })),
    teamB: (game.boxScore?.teamB || []).map(player => ({
      handle: cleanHandle(player.handle),
      upvotes: Number(player.upvotes || 0),
      note: player.note || ''
    }))
  };
}

function statCard(label, value, subtext) {
  return `
    <article class="card">
      <div class="label">${escapeHtml(label)}</div>
      <div class="kpi">${value}</div>
      <p class="muted">${escapeHtml(subtext || '')}</p>
    </article>
  `;
}

function renderTeamBox(players, leader) {
  if (!players.length) {
    return '<div class="empty">No box score entered yet.</div>';
  }

  return players
    .sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))
    .map(player => {
      const isLeader = leader && cleanHandle(player.handle).toLowerCase() === cleanHandle(leader.handle).toLowerCase();
      return `
        <div class="game-player-row${isLeader ? ' leader' : ''}">
          <span>
            <strong>${playerLink(player.handle)}</strong>
            ${player.note ? `<br><span class="muted">${escapeHtml(player.note)}</span>` : ''}
          </span>
          <strong>${fmt(player.upvotes)}</strong>
        </div>
      `;
    }).join('');
}

function getPlayerShare(player, game) {
  const box = normalizeBoxScore(game);
  const inA = box.teamA.some(p => cleanHandle(p.handle).toLowerCase() === cleanHandle(player.handle).toLowerCase());
  const teamScore = inA ? Number(game.teamAScore || 0) : Number(game.teamBScore || 0);
  return teamScore ? Math.round((Number(player.upvotes || 0) / teamScore) * 100) : 0;
}

function renderGameLog(game, box, winner, topPlayer) {
  const items = [];

  items.push(`${escapeHtml(game.teamA)} and ${escapeHtml(game.teamB)} met in ${escapeHtml(game.week || 'this matchup')}.`);

  if (gameStatus(game) === 'Upcoming') {
    items.push('This game has not been played yet.');
  } else {
    items.push(`${escapeHtml(game.teamA)} scored ${fmt(game.teamAScore || 0)} and ${escapeHtml(game.teamB)} scored ${fmt(game.teamBScore || 0)}.`);
  }

  if (winner) {
    items.push(`${escapeHtml(winner)} won by ${fmt(Math.abs(Number(game.teamAScore || 0) - Number(game.teamBScore || 0)))}.`);
  }

  if (topPlayer) {
    items.push(`${playerLink(topPlayer.handle)} led the game with ${fmt(topPlayer.upvotes)} upvotes.`);
  }

  return items.map(item => `<div class="game-log-item">${item}</div>`).join('');
}
