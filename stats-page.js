(() => {
  const safe = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const money = value => Number(value || 0).toLocaleString('en-US');
  const handleClean = value => String(value || '').replace(/^@/, '').trim();
  const norm = value => handleClean(value).toLowerCase();

  const localPlayerLink = handle => {
    const clean = handleClean(handle);
    return `<a href="profile.html?player=${encodeURIComponent(clean)}">@${safe(clean)}</a>`;
  };

  const localTeamLink = team => {
    const clean = String(team || '').trim();
    return `<a href="teams.html?team=${encodeURIComponent(clean)}">${safe(clean)}</a>`;
  };

  const statusOf = game => {
    const note = String(game?.note || '').trim().toLowerCase();
    if (note === 'final') return 'Final';
    if (note === 'live') return 'Live';
    return 'Upcoming';
  };

  const weekNumber = week => {
    const match = String(week || '').match(/\d+/);
    return match ? Number(match[0]) : 999;
  };

  const rootReady = callback => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  };

  rootReady(async () => {
    try {
      let originalData;

      if (typeof loadLeagueData === 'function') {
        originalData = await loadLeagueData();
      } else if (window.RUL_STATIC_DATA) {
        originalData = window.RUL_STATIC_DATA;
      } else {
        throw new Error('RUL_STATIC_DATA was not found. Check static-data.js.');
      }

      const saved = localStorage.getItem('RUL_WORKING_DATA');
      const data = saved ? JSON.parse(saved) : originalData;

      if (typeof pageHeader === 'function') {
        pageHeader(data, 'stats.html', 'Player', 'Stats', 'Sortable player rankings');
      }

      if (typeof pageFooter === 'function') {
        pageFooter(data);
      }

      let root = document.getElementById('statsRoot');
      const main = document.querySelector('main.shell') || document.querySelector('main') || document.body;

      if (!root) {
        root = document.createElement('section');
        root.id = 'statsRoot';
        main.appendChild(root);
      }

      const players = buildStats(data);
      let currentSort = 'gameLogUpvotes';
      let currentSearch = '';
      let currentTeam = '';

      const categories = [
        { key: 'gameLogUpvotes', label: 'Game Log Upvotes', note: 'Total box score upvotes' },
        { key: 'average', label: 'Average', note: 'Upvotes per logged game' },
        { key: 'gamesLogged', label: 'Games Logged', note: 'Games played' },
        { key: 'bestGame', label: 'Best Game', note: 'Highest single game' },
        { key: 'worstGame', label: 'Floor', note: 'Lowest logged game' },
        { key: 'twoKGames', label: '2K Games', note: 'Games with 2,000 plus' },
        { key: 'teamShare', label: 'Team Share', note: 'Share of team logged upvotes' },
        { key: 'potg', label: 'POTG Count', note: 'Led all players in a game' },
        { key: 'teamLeads', label: 'Team Leads', note: 'Led own team in a game' },
        { key: 'lastGame', label: 'Last Game', note: 'Most recent logged score' }
      ];

      const teams = data.teams || [];

      root.innerHTML = `
        <section class="grid four" id="statsSummary"></section>

        <section class="card" style="margin-top:16px">
          <div class="row">
            <span>
              <h2 class="card-title">Sortable Player Rankings</h2>
              <p class="muted">Tap a category card or table title to sort players best to worst.</p>
            </span>
            <span class="pill">${money(players.length)} Players</span>
          </div>

          <div class="grid two" style="margin-top:14px">
            <input id="statsSearch" placeholder="Search player or team">
            <select id="statsTeamFilter">
              <option value="">All teams</option>
              ${teams.map(team => `<option value="${safe(team.name)}">${safe(team.name)}</option>`).join('')}
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
          <div id="rankingTable"></div>
        </section>

        <section class="grid two" style="margin-top:16px">
          <article class="card">
            <h2 class="card-title">Hot Players</h2>
            <p class="muted">Best most recent logged games.</p>
            <div id="hotPlayers"></div>
          </article>

          <article class="card">
            <h2 class="card-title">Team Leaders</h2>
            <p class="muted">Top current player on each roster.</p>
            <div id="teamLeaders"></div>
          </article>
        </section>
      `;

      const sortPlayers = (list, key) => {
        return [...list].sort((a, b) => {
          const av = Number(a[key] || 0);
          const bv = Number(b[key] || 0);
          if (bv !== av) return bv - av;
          return Number(b.gameLogUpvotes || 0) - Number(a.gameLogUpvotes || 0)
            || a.handle.localeCompare(b.handle);
        });
      };

      const valueFor = (player, key) => {
        if (key === 'teamShare') return `${money(player.teamShare)}%`;
        return money(player[key] || 0);
      };

      const setSort = key => {
        currentSort = key;
        renderCategories();
        renderRanking();
      };

      const renderSummary = () => {
        const totalLeader = sortPlayers(players, 'gameLogUpvotes')[0];
        const avgLeader = sortPlayers(players, 'average').find(player => player.gamesLogged > 0);
        const bestLeader = sortPlayers(players, 'bestGame')[0];
        const totalLogged = players.reduce((sum, player) => sum + Number(player.gameLogUpvotes || 0), 0);

        document.getElementById('statsSummary').innerHTML = `
          ${summaryCard('Top Total', totalLeader ? localPlayerLink(totalLeader.handle) : 'None', totalLeader ? `${money(totalLeader.gameLogUpvotes)} game log upvotes` : '')}
          ${summaryCard('Top Average', avgLeader ? localPlayerLink(avgLeader.handle) : 'None', avgLeader ? `${money(avgLeader.average)} per game` : '')}
          ${summaryCard('Best Game', bestLeader ? localPlayerLink(bestLeader.handle) : 'None', bestLeader ? `${money(bestLeader.bestGame)} upvotes` : '')}
          ${summaryCard('Total Logged', money(totalLogged), 'All current roster players')}
        `;
      };

      const renderCategories = () => {
        const grid = document.getElementById('categoryGrid');

        grid.innerHTML = categories.map(category => {
          const leader = sortPlayers(players, category.key)[0];
          const active = currentSort === category.key ? ' active' : '';

          return `
            <button type="button" class="card quick-link-card stat-category${active}" data-sort-key="${safe(category.key)}" style="text-align:left">
              <div class="label">${safe(category.label)}</div>
              <div class="kpi">${leader ? valueFor(leader, category.key) : '0'}</div>
              <p class="muted">${leader ? `Leader: @${safe(leader.handle)}` : safe(category.note)}</p>
            </button>
          `;
        }).join('');

        grid.querySelectorAll('[data-sort-key]').forEach(button => {
          button.addEventListener('click', () => setSort(button.dataset.sortKey));
        });
      };

      const renderRanking = () => {
        const category = categories.find(item => item.key === currentSort) || categories[0];

        const filtered = sortPlayers(players.filter(player => {
          const search = norm(currentSearch);
          const matchesSearch = !search
            || norm(player.handle).includes(search)
            || norm(player.team).includes(search)
            || norm(player.conference).includes(search);

          const matchesTeam = !currentTeam || player.team === currentTeam;

          return matchesSearch && matchesTeam;
        }), currentSort);

        document.getElementById('activeRankingTitle').textContent = category.label;
        document.getElementById('activeRankingNote').textContent = category.note;
        document.getElementById('activeRankingCount').textContent = `${filtered.length} Players`;

        document.getElementById('rankingTable').innerHTML = rankingTable(filtered, currentSort);

        document.querySelectorAll('[data-stat-sort]').forEach(button => {
          button.addEventListener('click', () => setSort(button.dataset.statSort));
        });
      };

      const renderHotPlayers = () => {
        const hot = sortPlayers(players.filter(player => player.lastGame > 0), 'lastGame').slice(0, 10);

        document.getElementById('hotPlayers').innerHTML = hot.length ? hot.map((player, index) => `
          <div class="row">
            <span>
              <strong>${index + 1}. ${localPlayerLink(player.handle)}</strong><br>
              <span class="muted">${localTeamLink(player.team)} · last logged game</span>
            </span>
            <strong>${money(player.lastGame)}</strong>
          </div>
        `).join('') : '<div class="empty">No recent player scores found.</div>';
      };

      const renderTeamLeaders = () => {
        const grouped = {};
        players.forEach(player => {
          grouped[player.team] ||= [];
          grouped[player.team].push(player);
        });

        const leaders = Object.keys(grouped)
          .map(team => sortPlayers(grouped[team], 'gameLogUpvotes')[0])
          .filter(Boolean)
          .sort((a, b) => a.team.localeCompare(b.team));

        document.getElementById('teamLeaders').innerHTML = leaders.map(player => `
          <div class="row">
            <span>
              <strong>${localTeamLink(player.team)}</strong><br>
              <span class="muted">${localPlayerLink(player.handle)}</span>
            </span>
            <strong>${money(player.gameLogUpvotes)}</strong>
          </div>
        `).join('');
      };

      document.getElementById('statsSearch').addEventListener('input', event => {
        currentSearch = event.target.value || '';
        renderRanking();
      });

      document.getElementById('statsTeamFilter').addEventListener('change', event => {
        currentTeam = event.target.value || '';
        renderRanking();
      });

      renderSummary();
      renderCategories();
      renderRanking();
      renderHotPlayers();
      renderTeamLeaders();
    } catch (error) {
      console.error('Stats page failed:', error);

      let root = document.getElementById('statsRoot');
      if (!root) {
        root = document.createElement('section');
        root.id = 'statsRoot';
        (document.querySelector('main.shell') || document.querySelector('main') || document.body).appendChild(root);
      }

      root.innerHTML = `
        <section class="card">
          <h2>Stats failed to load</h2>
          <p class="muted stats-error-box">${safe(error?.message || error || 'Unknown error')}</p>
        </section>
      `;
    }
  });

  function summaryCard(label, value, subtext) {
    return `
      <article class="card">
        <div class="label">${safe(label)}</div>
        <div class="kpi">${value}</div>
        <p class="muted">${safe(subtext || '')}</p>
      </article>
    `;
  }

  function rankingTable(players, currentSort) {
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
      { label: '2K', key: 'twoKGames' },
      { label: 'Share', key: 'teamShare' },
      { label: 'POTG', key: 'potg' },
      { label: 'Leads', key: 'teamLeads' },
      { label: 'Last', key: 'lastGame' }
    ];

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${headers.map(header => {
                if (!header.key) return `<th>${safe(header.label)}</th>`;
                const active = header.key === currentSort ? ' active-sort' : '';
                return `
                  <th>
                    <button class="stat-sort-btn${active}" data-stat-sort="${safe(header.key)}" type="button">
                      ${safe(header.label)}${header.key === currentSort ? ' ↓' : ''}
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
                <td>${localPlayerLink(player.handle)}</td>
                <td>${localTeamLink(player.team)}</td>
                <td>${safe(player.conference || '')}</td>
                <td>${money(player.gameLogUpvotes)}</td>
                <td>${money(player.average)}</td>
                <td>${money(player.gamesLogged)}</td>
                <td>${money(player.bestGame)}</td>
                <td>${money(player.worstGame)}</td>
                <td>${money(player.twoKGames)}</td>
                <td>${money(player.teamShare)}%</td>
                <td>${money(player.potg)}</td>
                <td>${money(player.teamLeads)}</td>
                <td>${money(player.lastGame)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function buildStats(data) {
    const currentPlayers = (data.teams || []).flatMap(team => {
      return (team.roster || []).map(player => ({
        handle: handleClean(player.handle),
        team: team.name,
        conference: team.conference || ''
      }));
    });

    const teamTotals = {};
    currentPlayers.forEach(player => teamTotals[player.team] = 0);

    const stats = currentPlayers.map(player => {
      const logs = getLogs(data, player.handle);
      const values = logs.map(log => Number(log.upvotes || 0));
      const total = values.reduce((sum, value) => sum + value, 0);
      const gamesLogged = logs.length;

      return {
        ...player,
        logs,
        gameLogUpvotes: total,
        gamesLogged,
        average: gamesLogged ? Math.round(total / gamesLogged) : 0,
        bestGame: values.length ? Math.max(...values) : 0,
        worstGame: values.length ? Math.min(...values) : 0,
        lastGame: logs.length ? Number(logs[logs.length - 1].upvotes || 0) : 0,
        twoKGames: values.filter(value => value >= 2000).length,
        potg: logs.filter(log => log.potg).length,
        teamLeads: logs.filter(log => log.teamLead).length,
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

  function getLogs(data, handle) {
    const target = norm(handle);
    const logs = [];

    (data.games || []).forEach(game => {
      if (!game.boxScore) return;

      const status = statusOf(game);
      if (status !== 'Final' && status !== 'Live') return;

      const teamA = game.boxScore.teamA || [];
      const teamB = game.boxScore.teamB || [];
      const all = [...teamA, ...teamB];

      const aEntry = teamA.find(player => norm(player.handle) === target);
      const bEntry = teamB.find(player => norm(player.handle) === target);
      const entry = aEntry || bEntry;

      if (!entry) return;

      const ownTeam = aEntry ? teamA : teamB;
      const score = Number(entry.upvotes || 0);
      const gameMax = Math.max(...all.map(player => Number(player.upvotes || 0)));
      const teamMax = Math.max(...ownTeam.map(player => Number(player.upvotes || 0)));

      logs.push({
        week: game.week || '',
        date: game.date || '',
        upvotes: score,
        potg: score === gameMax && score > 0,
        teamLead: score === teamMax && score > 0
      });
    });

    return logs.sort((a, b) => weekNumber(a.week) - weekNumber(b.week));
  }
})();
