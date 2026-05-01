loadLeagueData().then(data => {
  pageHeader(data, 'roster.html', 'League', 'Roster', 'Players and Teams');
  pageFooter(data);

  const grid = $('#rosterGrid');
  const search = $('#search');

  if (!grid) {
    const main = document.querySelector('main') || document.body;
    main.innerHTML += `
      <section class="card">
        <h2>Roster container missing</h2>
        <p class="muted">The page needs an element with id="rosterGrid".</p>
      </section>
    `;
    return;
  }

  const scheduleStats = getScheduleTeamStats(data);

  function getTeamScheduleStats(teamName) {
    return scheduleStats.find(team => team.name === teamName) || {
      scheduleUpvotes: 0,
      gamesPlayed: 0,
      averageUpvotes: 0,
      wins: 0,
      losses: 0
    };
  }

  function teamLeader(team) {
    return [...(team.roster || [])].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0];
  }

  function renderRoster(term = '') {
    const cleanTerm = normalize(term);

    const cards = (data.teams || []).map(team => {
      const roster = [...(team.roster || [])].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0));
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
      const sched = getTeamScheduleStats(team.name);
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
            <div class="kpi">${fmt(sched.scheduleUpvotes)}</div>
            <p class="muted">${sched.gamesPlayed} games played · ${fmt(sched.averageUpvotes)} average per game</p>
          </div>

          <div class="mini-card">
            <div class="row">
              <span>Team Leader</span>
              <strong>${leader ? `${playerLink(leader.handle)} · ${fmt(leader.upvotes)}` : 'None'}</strong>
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
                    ${previousTeam ? `<br><span class="muted">Previous: ${escapeHtml(previousTeam)}</span>` : ''}
                  </span>
                  <strong>${fmt(player.upvotes)}</strong>
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
      <p class="muted">Check that static-data.js, utils.js, data-service.js, layout.js, and roster-page.js are all uploaded in the main repo folder.</p>
    </section>
  `;
});

function getScheduleTeamStats(data) {
  const teams = data.teams || [];
  const stats = {};

  teams.forEach(team => {
    stats[team.name] = {
      name: team.name,
      conference: team.conference || '',
      record: team.record || '',
      scheduleUpvotes: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      averageUpvotes: 0
    };
  });

  (data.games || []).forEach(game => {
    const aScore = Number(game.teamAScore || 0);
    const bScore = Number(game.teamBScore || 0);
    const completed = aScore > 0 || bScore > 0 || String(game.note || '').toLowerCase() === 'final';

    if (!completed) return;

    if (stats[game.teamA]) {
      stats[game.teamA].scheduleUpvotes += aScore;
      stats[game.teamA].gamesPlayed += 1;
      if (aScore > bScore) stats[game.teamA].wins += 1;
      if (aScore < bScore) stats[game.teamA].losses += 1;
    }

    if (stats[game.teamB]) {
      stats[game.teamB].scheduleUpvotes += bScore;
      stats[game.teamB].gamesPlayed += 1;
      if (bScore > aScore) stats[game.teamB].wins += 1;
      if (bScore < aScore) stats[game.teamB].losses += 1;
    }
  });

  Object.values(stats).forEach(team => {
    team.averageUpvotes = team.gamesPlayed ? Math.round(team.scheduleUpvotes / team.gamesPlayed) : 0;
  });

  return Object.values(stats);
}
