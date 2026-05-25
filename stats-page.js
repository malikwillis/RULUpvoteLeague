loadLeagueData().then(originalData => {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  const data = saved ? JSON.parse(saved) : originalData;

  pageHeader(data, 'stats.html', 'Player', 'Stats', 'Sortable leaderboards and advanced player rankings');
  pageFooter(data);

  const root = document.querySelector('main') || document.body;
  let players = buildAdvancedPlayerStats(data);
  let currentSort = 'gameLogUpvotes';
  let currentSearch = '';
  let currentTeamFilter = '';

  const categoryList = [
    { key: 'gameLogUpvotes', label: 'Game Log Upvotes', short: 'Game Log', note: 'Total box score upvotes' },
    { key: 'average', label: 'Average', short: 'Avg', note: 'Upvotes per logged game' },
    { key: 'gamesLogged', label: 'Games Logged', short: 'Games', note: 'Games played' },
    { key: 'bestGame', label: 'Best Game', short: 'Best', note: 'Highest single game' },
    { key: 'worstGame', label: 'Floor', short: 'Floor', note: 'Lowest logged game' },
    { key: 'boomGames', label: '2K Games', short: '2K', note: 'Games with 2,000 plus' },
    { key: 'teamShare', label: 'Team Share', short: 'Share', note: 'Share of team game log upvotes' },
    { key: 'playerOfGameCount', label: 'POTG Count', short: 'POTG', note: 'Led all players in a game' },
    { key: 'teamLeaderCount', label: 'Team Leads', short: 'Leads', note: 'Led own team in a game' },
    { key: 'lastGame', label: 'Last Game', short: 'Last', note: 'Most recent logged score' }
  ];

  root.innerHTML = `
    <section id="statsRoot">
      <section class="grid four" id="statsSummary"></section>

      <section class="card" style="margin-top:16px">
        <div class="row">
          <span>
            <h2 class="card-title">Sortable Player Rankings</h2>
            <p class="muted">Tap any category card or table column title to rank players best to worst.</p>
          </span>
          <span class="pill">${fmt(players.length)} Players</span>
        </div>

        <div class="grid two" style="margin-top:14px">
          <input id="statsSearch" placeholder="Search player or team">
          <select id="statsTeamFilter">
            <option value="">All teams</option>
            ${(data.teams || []).map(team => `<option value="${escapeHtml(team.name)}">${escapeHtml(team.name)}</option>`).join('')}
          </select>
        </div>
      </section>

      <section class="card" style="margin-top:16px">
        <h2 class="card-title">Ranking Categories</h2>
        <div id="categoryGrid" class="grid four"></div>
      </section>

      <section class="card" style="margin-top:16px">
        <div class="row">
          <span>
            <h2 class="card-title" id="activeRankingTitle">Game Log Upvotes</h2>
            <p class="muted" id="activeRankingNote">Total box score upvotes</p>
          </span>
          <span class="pill" id="activeRankingCount"></span>
        </div>
        <p class="muted">Tap column headers like Game Log, Avg, Games, Best, Share, POTG, or Last to sort.</p>
        <div id="rankingTable"></div>
      </section>

      <section class="grid two" style="margin-top:16px">
        <article class="card">
          <h2 class="card-title">Hot Players</h2>
          <p class="muted">Best recent logged game scores.</p>
          <div id="hotPlayers"></div>
        </article>

        <article class="card">
          <h2 class="card-title">Team Leaders</h2>
          <p class="muted">Top current player on each roster by game log upvotes.</p>
          <div id="teamLeaders"></div>
        </article>
      </section>

      <section class="card" style="margin-top:16px">
        <h2 class="card-title">Category Explainer</h2>
        <div class="grid two">
          <div class="mini-card">
            <strong>Game Log Upvotes</strong>
            <p class="muted">The only main player total. It adds the player scores from final and live box scores.</p>
          </div>
          <div class="mini-card">
            <strong>Team Share</strong>
            <p class="muted">How much of a player's current team's logged upvotes came from that player.</p>
          </div>
          <div class="mini-card">
            <strong>POTG Count</strong>
            <p class="muted">How many times the player had the highest score in the whole game.</p>
          </div>
          <div class="mini-card">
            <strong>Team Leads</strong>
            <p class="muted">How many times the player led their own team in a logged game.</p>
          </div>
        </div>
      </section>
    </section>
  `;

  renderSummary();
  renderCategories();
  renderMainRanking();
  renderHotPlayers();
  renderTeamLeaders();

  $('#statsSearch')?.addEventListener('input', event => {
    currentSearch = event.target.value || '';
    renderMainRanking();
  });

  $('#statsTeamFilter')?.addEventListener('change', event => {
    currentTeamFilter = event.target.value || '';
    renderMainRanking();
  });

  function setSort(key) {
    currentSort = key;
    renderCategories();
    renderMainRanking();
  }

  function renderSummary() {
    const ranked = sortPlayers(players, 'gameLogUpvotes');
    const topPlayer = ranked[0];
    const topAverage = sortPlayers(players, 'average').find(player => player.gamesLogged > 0);
    const topGame = sortPlayers(players, 'bestGame')[0];
    const total = players.reduce((sum, player) => sum + Number(player.gameLogUpvotes || 0), 0);

    $('#statsSummary').innerHTML = `
      ${summaryCard('Top Total', topPlayer ? `@${escapeHtml(topPlayer.handle)}` : 'None', topPlayer ? `${fmt(topPlayer.gameLogUpvotes)} game log upvotes` : '')}
      ${summaryCard('Top Average', topAverage ? `@${escapeHtml(topAverage.handle)}` : 'None', topAverage ? `${fmt(topAverage.average)} per game` : '')}
      ${summaryCard('Best Game', topGame ? `@${escapeHtml(topGame.handle)}` : 'None', topGame ? `${fmt(topGame.bestGame)} upvotes` : '')}
      ${summaryCard('Total Logged', fmt(total), 'All current roster players')}
    `;
  }

  function renderCategories() {
    $('#categoryGrid').innerHTML = categoryList.map(category => {
      const leader = sortPlayers(players, category.key)[0];
      const active = currentSort === category.key ? ' active' : '';

      return `
        <button class="card quick-link-card stat-category${active}" data-sort-key="${escapeHtml(category.key)}" style="text-align:left">
          <div class="label">${escapeHtml(category.label)}</div>
          <div class="kpi">${leader ? formatCategoryValue(leader, category.key) : '0'}</div>
          <p class="muted">${leader ? `Leader: @${escapeHtml(leader.handle)}` : category.note}</p>
        </button>
      `;
    }).join('');

    $all('.stat-category').forEach(button => {
      button.addEventListener('click', () => setSort(button.dataset.sortKey));
    });
  }

  function renderMainRanking() {
    const category = categoryList.find(item => item.key === currentSort) || categoryList[0];

    let filtered = players.filter(player => {
      const search = normalize(currentSearch);
      const matchesSearch = !search
        || normalize(player.handle).includes(search)
        || normalize(player.team).includes(search)
        || normalize(player.conference).includes(search);

      const matchesTeam = !currentTeamFilter || player.team === currentTeamFilter;

      return matchesSearch && matchesTeam;
    });

    filtered = sortPlayers(filtered, currentSort);

    $('#activeRankingTitle').textContent = category.label;
    $('#activeRankingNote').textContent = category.note;
    $('#activeRankingCount').textContent = `${filtered.length} Players`;

    $('#rankingTable').innerHTML = sortableStatsTable(filtered, currentSort, category.label);

    $all('[data-stat-sort]').forEach(button => {
      button.addEventListener('click', () => setSort(button.dataset.statSort));
    });
  }

  function renderHotPlayers() {
    const hot = [...players]
      .filter(player => player.lastGame > 0)
      .sort((a, b) => Number(b.lastGame || 0) - Number(a.lastGame || 0))
      .slice(0, 10);

    $('#hotPlayers').innerHTML = hot.length ? hot.map((player, index) => `
      <div class="row">
        <span>
          <strong>${index + 1}. ${playerLink(player.handle)}</strong><br>
          <span class="muted">${teamLink(player.team)} · last logged game</span>
        </span>
        <strong>${fmt(player.lastGame)}</strong>
      </div>
    `).join('') : '<div class="empty">No recent player scores found.</div>';
  }

  function renderTeamLeaders() {
    const grouped = groupBy(players, 'team');
    const leaders = Object.keys(grouped).map(team => {
      return sortPlayers(grouped[team], 'gameLogUpvotes')[0];
    }).filter(Boolean).sort((a, b) => String(a.team).localeCompare(String(b.team)));

    $('#teamLeaders').innerHTML = leaders.map(player => `
      <div class="row">
        <span>
          <strong>${teamLink(player.team)}</strong><br>
          <span class="muted">${playerLink(player.handle)}</span>
        </span>
        <strong>${fmt(player.gameLogUpvotes)}</strong>
      </div>
    `).join('');
  }
}).catch(error => {
  console.error('Stats page failed:', error);
  const root = document.querySelector('main') || document.body;
  root.innerHTML = `
    <section class="card">
      <h2>Stats failed to load</h2>
      <p class="muted">${escapeHtml(error.message || 'Check stats-page.js and static-data.js.')}</p>
    </section>
  `;
});

function summaryCard(label, value, subtext) {
  return `
    <article class="card">
      <div class="label">${escapeHtml(label)}</div>
      <div class="kpi">${value}</div>
      <p class="muted">${escapeHtml(subtext || '')}</p>
    </article>
  `;
}

function sortableStatsTable(players, currentSort, currentLabel) {
  const headers = [
    { label: '#', key: null },
    { label: 'Player', key: null },
    { label: 'Team', key: null },
    { label: 'Conf', key: null },
    { label: 'Game Log', key: 'gameLogUpvotes' },
    { label: 'Avg', key: 'average' },
    { label: 'Games', key: 'gamesLogged' },
    { label: 'Best', key: 'bestGame' },
    { label: 'Floor', key: 'worstGame' },
    { label: '2K', key: 'boomGames' },
    { label: 'Share', key: 'teamShare' },
    { label: 'POTG', key: 'playerOfGameCount' },
    { label: 'Leads', key: 'teamLeaderCount' },
    { label: 'Last', key: 'lastGame' }
  ];

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${headers.map(header => {
              if (!header.key) return `<th>${escapeHtml(header.label)}</th>`;
              const active = header.key === currentSort ? ' active-sort' : '';
              return `
                <th>
                  <button class="stat-sort-btn${active}" data-stat-sort="${escapeHtml(header.key)}" type="button">
                    ${escapeHtml(header.label)}${header.key === currentSort ? ' ↓' : ''}
                  </button>
                </th>
              `;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${players.map((player, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${playerLink(player.handle)}</td>
              <td>${teamLink(player.team)}</td>
              <td>${escapeHtml(player.conference || '')}</td>
              <td>${fmt(player.gameLogUpvotes)}</td>
              <td>${fmt(player.average)}</td>
              <td>${fmt(player.gamesLogged)}</td>
              <td>${fmt(player.bestGame)}</td>
              <td>${fmt(player.worstGame)}</td>
              <td>${fmt(player.boomGames)}</td>
              <td>${fmt(player.teamShare)}%</td>
              <td>${fmt(player.playerOfGameCount)}</td>
              <td>${fmt(player.teamLeaderCount)}</td>
              <td>${fmt(player.lastGame)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function buildAdvancedPlayerStats(data) {
  const currentPlayers = (data.teams || []).flatMap(team => {
    return (team.roster || []).map(player => ({
      handle: cleanHandle(player.handle),
      team: team.name,
      conference: team.conference || ''
    }));
  });

  const teamTotals = {};
  currentPlayers.forEach(player => {
    teamTotals[player.team] = 0;
  });

  const stats = currentPlayers.map(player => {
    const logs = getAdvancedPlayerLogs(data, player.handle);
    const values = logs.map(log => Number(log.upvotes || 0));
    const total = values.reduce((sum, value) => sum + value, 0);
    const gamesLogged = logs.length;
    const average = gamesLogged ? Math.round(total / gamesLogged) : 0;
    const bestGame = values.length ? Math.max(...values) : 0;
    const worstGame = values.length ? Math.min(...values) : 0;
    const lastGame = logs.length ? Number(logs[logs.length - 1].upvotes || 0) : 0;
    const boomGames = values.filter(value => value >= 2000).length;
    const playerOfGameCount = logs.filter(log => log.playerOfGame).length;
    const teamLeaderCount = logs.filter(log => log.teamLeader).length;

    return {
      ...player,
      logs,
      gameLogUpvotes: total,
      gamesLogged,
      average,
      bestGame,
      worstGame,
      lastGame,
      boomGames,
      playerOfGameCount,
      teamLeaderCount,
      teamShare: 0
    };
  });

  stats.forEach(player => {
    teamTotals[player.team] += Number(player.gameLogUpvotes || 0);
  });

  stats.forEach(player => {
    player.teamShare = teamTotals[player.team]
      ? Math.round((Number(player.gameLogUpvotes || 0) / teamTotals[player.team]) * 100)
      : 0;
  });

  return stats;
}

function getAdvancedPlayerLogs(data, handle) {
  const target = cleanHandle(handle).toLowerCase();
  const logs = [];

  (data.games || []).forEach(game => {
    if (!game.boxScore) return;

    const status = statsGameStatus(game);
    if (status !== 'Final' && status !== 'Live') return;

    const teamAPlayers = game.boxScore.teamA || [];
    const teamBPlayers = game.boxScore.teamB || [];
    const allGamePlayers = [...teamAPlayers, ...teamBPlayers];

    const teamAEntry = teamAPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);
    const teamBEntry = teamBPlayers.find(player => cleanHandle(player.handle).toLowerCase() === target);
    const entry = teamAEntry || teamBEntry;

    if (!entry) return;

    const ownTeamPlayers = teamAEntry ? teamAPlayers : teamBPlayers;
    const maxGameScore = Math.max(...allGamePlayers.map(player => Number(player.upvotes || 0)));
    const maxTeamScore = Math.max(...ownTeamPlayers.map(player => Number(player.upvotes || 0)));
    const playerScore = Number(entry.upvotes || 0);

    logs.push({
      week: game.week || '',
      date: game.date || '',
      status,
      team: teamAEntry ? game.teamA : game.teamB,
      opponent: teamAEntry ? game.teamB : game.teamA,
      upvotes: playerScore,
      playerOfGame: playerScore === maxGameScore && playerScore > 0,
      teamLeader: playerScore === maxTeamScore && playerScore > 0
    });
  });

  return logs.sort((a, b) => weekNumber(a.week) - weekNumber(b.week));
}

function statsGameStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function weekNumber(week) {
  const match = String(week || '').match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function sortPlayers(list, key) {
  return [...list].sort((a, b) => {
    const av = Number(a[key] || 0);
    const bv = Number(b[key] || 0);

    if (bv !== av) return bv - av;

    return Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0)
      || cleanHandle(a.handle).localeCompare(cleanHandle(b.handle));
  });
}

function formatCategoryValue(player, key) {
  if (key === 'teamShare') return `${fmt(player.teamShare)}%`;
  if (key === 'gamesLogged') return fmt(player.gamesLogged);
  if (key === 'playerOfGameCount') return fmt(player.playerOfGameCount);
  if (key === 'teamLeaderCount') return fmt(player.teamLeaderCount);
  if (key === 'boomGames') return fmt(player.boomGames);
  return fmt(player[key] || 0);
}
