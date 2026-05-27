const RUL_DRAFT_FALLBACK = {
  teams: ["Kitties", "Phantoms", "Vampires", "Bandits", "Angels", "Reapers", "Mammoths", "Voltage"],
  roundValue: {1:100,2:70,3:45,4:28,5:16,6:8},
  seasons: {
    S2: {
      Kitties: {Kitties:[4], Phantoms:[1], Angels:[1,2,3,4], Mammoths:[2], Vampires:[2], Voltage:[6]},
      Phantoms: {},
      Vampires: {Vampires:[3,4,5], Kitties:[2], Phantoms:[6], Voltage:[2]},
      Bandits: {Bandits:[1,2,3,4,5,6], Voltage:[4], Angels:[6], Phantoms:[5], Kitties:[3]},
      Angels: {Angels:[5], Voltage:[3], Kitties:[5]},
      Reapers: {Reapers:[1,3,4,5,6], Voltage:[5], Mammoths:[4,5], Vampires:[1], Phantoms:[4]},
      Mammoths: {Mammoths:[1,3,6], Vampires:[6]},
      Voltage: {Voltage:[1], Phantoms:[2,3], Kitties:[1,6], Reapers:[2]}
    },
    S3: {
      Kitties: {Kitties:[1,2,3,4,5,6]},
      Phantoms: {Phantoms:[1,2,6], Vampires:[4], Mammoths:[6]},
      Vampires: {Vampires:[1,2,3,5,6]},
      Bandits: {Bandits:[1,2,4,5,6]},
      Angels: {Angels:[1,2,3,4,5,6]},
      Reapers: {Reapers:[1,2,3,4,5,6], Bandits:[3], Voltage:[3]},
      Mammoths: {Mammoths:[1,2,3,4,5], Vampires:[4], Phantoms:[5]},
      Voltage: {Voltage:[1,2,4,5,6], Phantoms:[3,4]}
    }
  }
};

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

  pageHeader(data, 'draft-capital.html', 'Draft Capital', 'RUL Draft Capital', 'Season 2 and Season 3 pick ownership');
  pageFooter(data);

  const root = document.getElementById('draftCapitalRoot') || document.querySelector('main') || document.body;
  const capital = normalizeCapital(data);
  let selectedSeason = new URLSearchParams(location.search).get('season') || 'S2';

  root.innerHTML = `
    <section class="draft-tabs">
      <button class="btn" type="button" data-season="S2">S2 Draft</button>
      <button class="btn" type="button" data-season="S3">S3 Draft</button>
    </section>

    <section class="card projected-order-card" style="margin-top:16px">
      <div class="row">
        <span>
          <h2 class="card-title" id="projectedTitle"></h2>
          <p class="muted">Projected from the current game results. When score entry updates records or final scores, this order recalculates from the newest saved data.</p>
        </span>
        <span class="pill">Snake Draft</span>
      </div>
      <div id="projectedOrder"></div>
    </section>

    <section id="draftSummary" class="grid four" style="margin-top:16px"></section>

    <section class="grid two" style="margin-top:16px">
      <article class="card">
        <h2 class="card-title" id="bestCapitalTitle"></h2>
        <div id="draftRankings"></div>
      </article>

      <article class="card">
        <h2 class="card-title" id="premiumTitle"></h2>
        <p class="muted">Firsts and seconds only.</p>
        <div id="premiumRankings"></div>
      </article>
    </section>

    <section class="card" style="margin-top:16px">
      <div class="row">
        <span>
          <h2 class="card-title" id="teamBoardTitle"></h2>
          <p class="muted">Each card shows the picks that team owns. Yellow tinted picks are first or second rounders. Outlined picks are the team's own original picks.</p>
        </span>
        <span class="pill" id="teamBoardCount"></span>
      </div>
    </section>

    <section id="draftTeamCards" class="grid two" style="margin-top:16px"></section>

    <section class="card" style="margin-top:16px">
      <h2 class="card-title" id="trackerTitle"></h2>
      <p class="muted">Shows who owns each original team's picks by round.</p>
      <div id="originalPickTracker"></div>
    </section>
  `;

  document.querySelectorAll('[data-season]').forEach(button => {
    button.addEventListener('click', () => {
      selectedSeason = button.dataset.season;
      const url = new URL(location.href);
      url.searchParams.set('season', selectedSeason);
      history.replaceState(null, '', url.toString());
      renderSeason();
    });
  });

  renderSeason();

  function renderSeason() {
    const standingsOrder = projectedBaseOrder(data);

    document.querySelectorAll('[data-season]').forEach(button => {
      button.classList.toggle('active', button.dataset.season === selectedSeason);
    });

    const seasonTeams = buildSeasonTeams(capital, selectedSeason);
    const ranked = [...seasonTeams].sort((a, b) => b.valueScore - a.valueScore || b.firsts - a.firsts || b.totalPicks - a.totalPicks);
    const premium = [...seasonTeams].sort((a, b) => b.premiumPicks - a.premiumPicks || b.valueScore - a.valueScore);
    const totalPicks = seasonTeams.reduce((sum, team) => sum + team.totalPicks, 0);
    const totalFirsts = seasonTeams.reduce((sum, team) => sum + team.firsts, 0);

    document.getElementById('projectedTitle').textContent = `${selectedSeason} Projected Snake Draft Order`;

    document.getElementById('draftSummary').innerHTML = `
      ${statCard('Best Capital', ranked[0]?.team || 'None', ranked[0] ? `${fmt(ranked[0].valueScore)} value score` : '')}
      ${statCard('Most Firsts', premium[0]?.team || 'None', premium[0] ? `${fmt(premium[0].firsts)} firsts` : '')}
      ${statCard('Total Picks', fmt(totalPicks), `${selectedSeason} picks listed`)}
      ${statCard('Total Firsts', fmt(totalFirsts), 'Owned first round picks')}
    `;

    document.getElementById('bestCapitalTitle').textContent = `Best ${selectedSeason} Draft Capital`;
    document.getElementById('premiumTitle').textContent = `${selectedSeason} Premium Pick Leaders`;
    document.getElementById('teamBoardTitle').textContent = `${selectedSeason} Team Pick Boards`;
    document.getElementById('teamBoardCount').textContent = `${seasonTeams.length} Teams`;
    document.getElementById('trackerTitle').textContent = `${selectedSeason} Original Pick Tracker`;

    document.getElementById('projectedOrder').innerHTML = projectedOrderTable(capital, selectedSeason, standingsOrder);
    document.getElementById('draftRankings').innerHTML = ranked.map((team, index) => rankRow(index, team.team, `${fmt(team.valueScore)} value`, `${fmt(team.totalPicks)} picks · ${fmt(team.firsts)} firsts`)).join('');
    document.getElementById('premiumRankings').innerHTML = premium.map((team, index) => rankRow(index, team.team, `${fmt(team.premiumPicks)} premium`, `${fmt(team.firsts)} firsts · ${fmt(team.seconds)} seconds`)).join('');
    document.getElementById('draftTeamCards').innerHTML = ranked.map(renderTeamCard).join('');
    document.getElementById('originalPickTracker').innerHTML = originalTracker(capital, selectedSeason);
  }
}).catch(error => {
  console.error(error);
  const root = document.getElementById('draftCapitalRoot') || document.querySelector('main') || document.body;
  root.innerHTML = `<section class="card"><h2>Draft capital failed to load</h2><p class="muted">${escapeHtml(error.message || 'Check draft files.')}</p></section>`;
});

function normalizeCapital(data) {
  const teams = RUL_DRAFT_FALLBACK.teams;
  const roundValue = RUL_DRAFT_FALLBACK.roundValue;
  const capital = { teams: {} };

  teams.forEach(team => {
    capital.teams[team] = { S2: [], S3: [] };
  });

  if (data.draftCapital && data.draftCapital.teams) {
    teams.forEach(team => {
      ['S2', 'S3'].forEach(season => {
        const picks = ((data.draftCapital.teams[team] || {})[season] || []);
        capital.teams[team][season] = picks.map(pick => ({
          owner: team,
          season,
          originalTeam: pick.originalTeam,
          round: Number(pick.round),
          value: Number(pick.value || roundValue[Number(pick.round)] || 0)
        })).filter(pick => pick.originalTeam && pick.round);
      });
    });

    const hasAny = teams.some(team => capital.teams[team].S2.length || capital.teams[team].S3.length);
    if (hasAny) return capital;
  }

  ['S2', 'S3'].forEach(season => {
    teams.forEach(owner => {
      const groups = RUL_DRAFT_FALLBACK.seasons[season][owner] || {};
      Object.keys(groups).forEach(originalTeam => {
        groups[originalTeam].forEach(round => {
          capital.teams[owner][season].push({
            owner,
            season,
            originalTeam,
            round,
            value: roundValue[round] || 0
          });
        });
      });
    });
  });

  return capital;
}

function buildSeasonTeams(capital, season) {
  return Object.keys(capital.teams).map(team => {
    const picks = [...((capital.teams[team] || {})[season] || [])].sort((a, b) => a.round - b.round || a.originalTeam.localeCompare(b.originalTeam));

    return {
      team,
      season,
      picks,
      totalPicks: picks.length,
      firsts: picks.filter(pick => pick.round === 1).length,
      seconds: picks.filter(pick => pick.round === 2).length,
      premiumPicks: picks.filter(pick => pick.round <= 2).length,
      valueScore: picks.reduce((sum, pick) => sum + Number(pick.value || 0), 0)
    };
  });
}

function projectedBaseOrder(data) {
  const teamStats = {};

  (data.teams || []).forEach(team => {
    teamStats[team.name] = {
      name: team.name,
      wins: 0,
      losses: 0,
      ties: 0,
      gamesPlayed: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      fallbackRecord: team.record || '0-0',
      fallbackUpvotes: Number(team.totalUpvotes || 0)
    };
  });

  (data.games || []).forEach(game => {
    if (!teamStats[game.teamA] || !teamStats[game.teamB]) return;

    const status = String(game.note || '').trim().toLowerCase();
    const aScore = Number(game.teamAScore || 0);
    const bScore = Number(game.teamBScore || 0);
    const hasScore = aScore !== 0 || bScore !== 0;
    const isCountable = status === 'final' || status === 'live' || hasScore;

    if (!isCountable || aScore === bScore) return;

    const a = teamStats[game.teamA];
    const b = teamStats[game.teamB];

    a.gamesPlayed += 1;
    b.gamesPlayed += 1;

    a.pointsFor += aScore;
    a.pointsAgainst += bScore;

    b.pointsFor += bScore;
    b.pointsAgainst += aScore;

    if (aScore > bScore) {
      a.wins += 1;
      b.losses += 1;
    } else {
      b.wins += 1;
      a.losses += 1;
    }
  });

  const rows = Object.values(teamStats).map(team => {
    if (team.gamesPlayed === 0) {
      const fallback = localParseRecord(team.fallbackRecord);
      const fallbackGames = fallback.wins + fallback.losses;

      return {
        ...team,
        wins: fallback.wins,
        losses: fallback.losses,
        gamesPlayed: fallbackGames,
        pct: fallbackGames ? fallback.wins / fallbackGames : 0,
        pointsFor: team.fallbackUpvotes,
        pointDiff: 0
      };
    }

    return {
      ...team,
      pct: team.gamesPlayed ? team.wins / team.gamesPlayed : 0,
      pointDiff: team.pointsFor - team.pointsAgainst
    };
  });

  if (!rows.length) return RUL_DRAFT_FALLBACK.teams;

  return rows.sort((a, b) => {
    return a.pct - b.pct
      || a.wins - b.wins
      || b.losses - a.losses
      || a.pointDiff - b.pointDiff
      || a.pointsFor - b.pointsFor
      || a.name.localeCompare(b.name);
  }).map(team => team.name);
}

function projectedOrderTable(capital, season, baseOrder) {
  const rows = [];
  const ownerMap = {};

  Object.keys(capital.teams).forEach(owner => {
    ((capital.teams[owner] || {})[season] || []).forEach(pick => {
      ownerMap[`${pick.originalTeam}-${pick.round}`] = owner;
    });
  });

  for (let round = 1; round <= 6; round++) {
    const order = round % 2 === 1 ? baseOrder : [...baseOrder].reverse();

    order.forEach((originalTeam, index) => {
      const pickNumber = (round - 1) * baseOrder.length + index + 1;
      const owner = ownerMap[`${originalTeam}-${round}`] || 'Unknown';

      rows.push([
        pickNumber,
        `R${round}.${index + 1}`,
        owner,
        originalTeam
      ]);
    });
  }

  return table(['Pick', 'Slot', 'Current Owner', 'Original Team'], rows);
}

function originalTracker(capital, season) {
  const rows = [];

  Object.keys(capital.teams).forEach(originalTeam => {
    const owned = [];

    Object.keys(capital.teams).forEach(owner => {
      ((capital.teams[owner] || {})[season] || []).filter(pick => pick.originalTeam === originalTeam).forEach(pick => {
        owned.push({ round: pick.round, owner });
      });
    });

    rows.push([
      originalTeam,
      owned.sort((a, b) => a.round - b.round).map(pick => `R${pick.round}: ${pick.owner}`).join(', ') || 'None'
    ]);
  });

  return table(['Original Team', 'Current Owner By Round'], rows);
}

function renderTeamCard(team) {
  return `
    <article class="card">
      <div class="row">
        <span>
          <div class="label">${escapeHtml(team.season)}</div>
          <h2 class="card-title">${teamLink(team.team)}</h2>
        </span>
        <span class="pill">${fmt(team.totalPicks)} Picks</span>
      </div>

      <div class="grid three" style="margin-top:14px">
        <div class="mini-card"><div class="label">Value</div><div class="kpi">${fmt(team.valueScore)}</div></div>
        <div class="mini-card"><div class="label">Firsts</div><div class="kpi">${fmt(team.firsts)}</div></div>
        <div class="mini-card"><div class="label">Premium</div><div class="kpi">${fmt(team.premiumPicks)}</div></div>
      </div>

      ${team.picks.length ? `
        <div class="draft-pick-grid" style="margin-top:16px">
          ${team.picks.map(pick => `
            <div class="draft-pick${pick.originalTeam === team.team ? ' own' : ''}${pick.round <= 2 ? ' premium' : ''}">
              <div class="draft-round">R${fmt(pick.round)}</div>
              <div class="draft-original">${escapeHtml(pick.originalTeam)}</div>
            </div>
          `).join('')}
        </div>
      ` : `<div class="draft-empty" style="margin-top:16px">No picks currently listed.</div>`}
    </article>
  `;
}

function statCard(label, value, subtext) {
  return `<article class="card"><div class="label">${escapeHtml(label)}</div><div class="kpi">${escapeHtml(value)}</div><p class="muted">${escapeHtml(subtext || '')}</p></article>`;
}

function rankRow(index, team, value, note) {
  return `<div class="draft-rank-row"><span class="draft-rank-badge">${index + 1}</span><span><strong>${teamLink(team)}</strong><br><span class="muted">${escapeHtml(note)}</span></span><strong>${escapeHtml(value)}</strong></div>`;
}

function localParseRecord(record) {
  const match = String(record || '0-0').match(/(\d+)\s*-\s*(\d+)/);

  if (!match) {
    return { wins: 0, losses: 0 };
  }

  return {
    wins: Number(match[1]),
    losses: Number(match[2])
  };
}
