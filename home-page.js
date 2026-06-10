loadLeagueData().then(originalData => {
  let data = originalData || window.RUL_STATIC_DATA || {};

  try {
    const saved = localStorage.getItem('RUL_WORKING_DATA');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.teams && parsed.games) data = parsed;
    }
  } catch (error) {
    localStorage.removeItem('RUL_WORKING_DATA');
  }

  pageHeader(data, 'index.html', 'Official RUL Home Page', 'Real Upvote League', "Real's #1 Upvote League");
  pageFooter(data);

  const root = document.getElementById('homeRoot') || document.querySelector('main') || document.body;
  const teams = data.teams || [];
  const games = data.games || [];
  const players = buildHomePlayers(data);

  const liveGames = games.filter(game => homeGameStatus(game) === 'Live');
  const finals = games.filter(game => homeGameStatus(game) === 'Final');
  const upcoming = games.filter(game => homeGameStatus(game) === 'Upcoming');
  const topPlayers = [...players].sort((a, b) => b.upvotes - a.upvotes).slice(0, 8);
  const standings = buildHomeStandings(teams).slice(0, 5);

  root.innerHTML = `
    <section class="card home-hero-card">
      <div class="label">Current Season</div>
      <h2 class="card-title">${escapeHtml(data.league?.season || 'Season 1')}</h2>
      <p class="muted">This site is a work in progress. Historical data and league tools will keep being added.</p>

      <div class="home-actions" style="margin-top:18px">
        <a class="btn active" href="standings.html">Standings</a>
        <a class="btn" href="draft-capital.html">Draft Capital</a>
        <a class="btn" href="live.html">Live Scores</a>
        <a class="btn" href="stats.html">Stats</a>
      </div>
    </section>

    <section class="home-section">
      <div class="home-section-title">
        <span>
          <h2 class="card-title">League Central</h2>
          <p class="muted">Access current season information and league resources.</p>
        </span>
      </div>

      <section class="grid three">
        ${centralCard('Standings', 'Overall records, conference records, and team upvotes.', 'standings.html')}
        ${centralCard('Live Scores', 'Track live games and recent results.', 'live.html')}
        ${centralCard('Games', 'Full game center with box scores and recaps.', 'games.html')}
        ${centralCard('Draft Capital', 'S2 and S3 picks with projected snake order.', 'draft-capital.html')}
        ${centralCard('Stats', 'Sortable player leaders and rankings.', 'stats.html')}
        ${centralCard('Rosters', 'Every team and every player in the league.', 'roster.html')}
      </section>
    </section>

    <section class="grid two home-section">
      <article class="card">
        <div class="home-section-title">
          <span>
            <h2 class="card-title">${liveGames.length ? 'Live Now' : 'Next Games'}</h2>
            <p class="muted">${fmt(finals.length)} finals · ${fmt(upcoming.length)} upcoming</p>
          </span>
          <a class="btn" href="games.html">Games</a>
        </div>
        ${(liveGames.length ? liveGames : upcoming.slice(0, 5)).map(renderGame).join('') || '<div class="empty">No games listed.</div>'}
      </article>

      <article class="card">
        <div class="home-section-title">
          <span>
            <h2 class="card-title">Top Standings</h2>
            <p class="muted">Current record leaders.</p>
          </span>
          <a class="btn" href="standings.html">Open</a>
        </div>
        ${standings.map((team, index) => `
          <div class="trend-row">
            <span class="rank-badge">${index + 1}</span>
            <span>
              <strong>${teamLink(team.name)}</strong><br>
              <span class="muted">${escapeHtml(team.conference || '')}</span>
            </span>
            <strong>${escapeHtml(team.record || '0-0')}</strong>
          </div>
        `).join('') || '<div class="empty">No standings listed.</div>'}
      </article>
    </section>

    <section class="grid two home-section">
      <article class="card">
        <div class="home-section-title">
          <span>
            <h2 class="card-title">League Leaders</h2>
            <p class="muted">Top current roster upvote totals.</p>
          </span>
          <a class="btn" href="stats.html">Stats</a>
        </div>
        ${topPlayers.map((player, index) => `
          <div class="trend-row">
            <span class="rank-badge">${index + 1}</span>
            <span>
              <strong>${playerLink(player.handle)}</strong><br>
              <span class="muted">${teamLink(player.team)}</span>
            </span>
            <strong>${fmt(player.upvotes)}</strong>
          </div>
        `).join('') || '<div class="empty">No stats listed.</div>'}
      </article>

      <article class="card">
        <div class="home-section-title">
          <span>
            <h2 class="card-title">League History</h2>
            <p class="muted">Historical data, draft pages, game logs, transactions, standings, and records are built into the RUL hub.</p>
          </span>
          <a class="btn" href="transactions.html">Transactions</a>
        </div>
        <div class="grid two">
          <div class="mini-card">
            <div class="label">Teams</div>
            <div class="kpi">${fmt(teams.length)}</div>
          </div>
          <div class="mini-card">
            <div class="label">Players</div>
            <div class="kpi">${fmt(players.length)}</div>
          </div>
        </div>
      </article>
    </section>
  `;
}).catch(error => {
  console.error(error);
  const root = document.getElementById('homeRoot') || document.querySelector('main') || document.body;
  root.innerHTML = `<section class="card"><h2>Home page failed to load</h2><p class="muted">${escapeHtml(error.message || 'Check files.')}</p></section>`;
});

function centralCard(title, text, href) {
  return `
    <a class="card central-card" href="${href}">
      <span>
        <div class="label">${escapeHtml(title)}</div>
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">${escapeHtml(text)}</p>
      </span>
      <span class="arrow">Open →</span>
    </a>
  `;
}

function homeGameStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();

  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function renderGame(game) {
  const status = homeGameStatus(game);

  return `
    <div class="home-feed-card">
      <div class="score-strip">
        <span>
          <strong>${teamLink(game.teamA)}</strong><br>
          <span class="score-num">${fmt(game.teamAScore || 0)}</span>
        </span>
        <span class="pill">${escapeHtml(status)}</span>
        <span class="right">
          <strong>${teamLink(game.teamB)}</strong><br>
          <span class="score-num">${fmt(game.teamBScore || 0)}</span>
        </span>
      </div>
      <p class="muted">${escapeHtml(game.week || '')} · ${escapeHtml(game.date || '')} · ${escapeHtml(game.type || '')}</p>
    </div>
  `;
}

function buildHomePlayers(data) {
  return (data.teams || []).flatMap(team => {
    return (team.roster || []).map(player => ({
      handle: cleanHandle(player.handle),
      team: team.name,
      upvotes: Number(player.upvotes || 0)
    }));
  });
}

function buildHomeStandings(teams) {
  return [...(teams || [])].sort((a, b) => {
    const ar = parseHomeRecord(a.record);
    const br = parseHomeRecord(b.record);
    const ap = ar.games ? ar.wins / ar.games : 0;
    const bp = br.games ? br.wins / br.games : 0;
    return bp - ap || br.wins - ar.wins || Number(b.totalUpvotes || 0) - Number(a.totalUpvotes || 0);
  });
}

function parseHomeRecord(record) {
  const match = String(record || '0-0').match(/(\d+)\s*-\s*(\d+)/);
  const wins = match ? Number(match[1]) : 0;
  const losses = match ? Number(match[2]) : 0;
  return { wins, losses, games: wins + losses };
}
