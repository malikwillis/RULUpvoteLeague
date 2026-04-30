function pageHeader(data, active, title, accentWord, subtitle){
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="shell">
      <header class="site-head">
        <div class="header-top">${escapeHtml(data.league.updatedLabel)}</div>
        <h1>${escapeHtml(title)} ${accentWord ? `<span>${escapeHtml(accentWord)}</span>` : ''}</h1>
        <div class="subline">${escapeHtml(subtitle || data.league.portalLabel)}</div>
        <nav class="topnav">
          <a href="index.html">Home</a>
          <a href="live.html">Live</a>
          <a href="draft.html">Draft</a>
          <a href="standings.html">Standings</a>
          <a href="transactions.html">Transactions</a>
          <a href="stats.html">Stats</a>
          <a href="roster.html">Roster</a>
          <a href="teams.html">Teams</a>
          <a href="gm.html">GM</a>
        </nav>
      </header>
    </div>`);
  setActiveNav(active);
}
function pageFooter(data){
  document.body.insertAdjacentHTML('beforeend', `<footer>Made for ${escapeHtml(data.league.shortName)} by ${escapeHtml(data.league.madeBy)}</footer>`);
}
function renderGameCard(game, data){
  const final = isFinal(game);
  const aScore = Number(game.teamAScore) || 0;
  const bScore = Number(game.teamBScore) || 0;
  const aWin = final && aScore > bScore;
  const bWin = final && bScore > aScore;
  const total = Math.max(1, aScore + bScore);
  const leader = aWin ? game.teamA : bWin ? game.teamB : 'Tied';
  const diff = Math.abs(aScore - bScore);
  const leadPct = final ? Math.round((Math.max(aScore,bScore) / total) * 100) : 50;
  return `
    <div class="live-row-item" data-game="${escapeHtml(game.week)} ${escapeHtml(game.teamA)} ${escapeHtml(game.teamB)}">
      <div class="live-matchup">
        <div>
          <div class="team-name ${aWin ? 'winner' : ''}">${teamLink(game.teamA)}${aWin ? ' 🏆' : ''}</div>
          <div class="team-score">${final ? fmt(aScore) : '0'}</div>
        </div>
        <div>
          <div class="vs">VS</div>
          <div class="diff">${final ? `${escapeHtml(leader)} by ${fmt(diff)}` : escapeHtml(game.note || 'Upcoming')}</div>
        </div>
        <div style="text-align:right">
          <div class="team-name ${bWin ? 'winner' : ''}">${teamLink(game.teamB)}${bWin ? ' 🏆' : ''}</div>
          <div class="team-score">${final ? fmt(bScore) : '0'}</div>
        </div>
      </div>
      <div class="projection">
        <div class="proj-label">${escapeHtml(game.week)} • ${escapeHtml(game.date)} • ${escapeHtml(game.type)}</div>
        <div class="bar-wrap"><div class="bar-fill" style="width:${leadPct}%"></div></div>
      </div>
      <div class="mvp">${final ? `UPVOTE WINNER — ${escapeHtml(leader)}` : 'MATCHUP NOT PLAYED YET'}</div>
    </div>`;
}
function renderTeamMini(team){
  const top = [...team.roster].sort((a,b) => Number(b.upvotes) - Number(a.upvotes))[0] || {handle:'none',upvotes:0};
  return `<article class="card team-card" style="--team-accent:${escapeHtml(team.accent || '#e8ff3c')}">
    <h2 class="card-title">${teamLink(team.name)}</h2>
    <div class="row"><span class="muted">Record</span><strong>${escapeHtml(team.record)}</strong></div>
    <div class="row"><span class="muted">Conference</span><strong>${escapeHtml(team.conference)}</strong></div>
    <div class="row"><span class="muted">Total Upvotes</span><strong>${fmt(team.totalUpvotes)}</strong></div>
    <div class="row"><span class="muted">Top Player</span><strong>${playerLink(top.handle)}</strong></div>
  </article>`;
}
