loadLeagueData().then(data => {
  pageHeader(data, 'live.html', 'Live', 'Scores', 'Official Match Center');
  pageFooter(data);
  activateTabs();

  const nextGames = data.games.filter(g => !isFinal(g) && g.note !== 'Event');
  const liveTarget = $('#live-scoring');

  if (nextGames.length) {
    liveTarget.innerHTML = nextGames.slice(0, 6).map(g => renderGameCard(g, data)).join('');
  } else {
    liveTarget.innerHTML = '<div class="empty">No upcoming games are currently listed.</div>';
  }

  const grouped = groupBy(data.games, 'week');

  $('#schedule-content').innerHTML = Object.entries(grouped).map(([week, games]) => `
    <div class="schedule-group">
      <div class="schedule-date">${escapeHtml(week)}</div>
      ${games.map(g => `
        <div class="schedule-row live-row-item" data-game="${escapeHtml(gameKey(g))}">
          <span class="sched-team">${teamLink(g.teamA)}</span>
          <span class="sched-vs">VS</span>
          <span class="sched-team right">${teamLink(g.teamB)}</span>
          <span class="pill">${escapeHtml(g.date)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');

  $('#history-content').innerHTML = data.games
    .filter(isFinal)
    .slice()
    .reverse()
    .map(g => renderGameCard(g, data))
    .join('') || '<div class="empty">No finals yet.</div>';

  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link) return;

    const card = event.target.closest('.live-row-item');
    if (!card) return;

    const game = data.games.find(g => gameKey(g) === card.dataset.game);
    if (!game) return;

    $('#game-details').innerHTML = renderGameDetails(game);
    $('#game-modal').classList.add('open');
  });

  document.addEventListener('click', event => {
    if (event.target.matches('[data-close="true"]') || event.target.id === 'game-modal') {
      $('#game-modal').classList.remove('open');
    }
  });
});

function gameKey(game) {
  return `${game.week} ${game.teamA} ${game.teamB}`;
}

function sumPlayers(players) {
  return (players || []).reduce((sum, player) => sum + Number(player.upvotes || 0), 0);
}

function renderPlayerRows(players) {
  const sorted = [...(players || [])].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0));
  if (!sorted.length) {
    return '<div class="boxscore-row"><span>No player box score entered yet.</span><span></span></div>';
  }

  return sorted.map((player, index) => `
    <div class="boxscore-row">
      <span>${index + 1}. ${playerLink(player.handle)} ${player.note ? `<span class="muted">(${escapeHtml(player.note)})</span>` : ''}</span>
      <strong>${fmt(player.upvotes)}</strong>
    </div>
  `).join('');
}

function renderTeamBox(title, officialScore, players) {
  const submitted = sumPlayers(players);
  const mismatch = Number(officialScore || 0) !== submitted;

  return `
    <div class="boxscore-card">
      <div class="boxscore-team">
        <span>${teamLink(title)}</span>
        <span>${fmt(officialScore)}</span>
      </div>
      ${renderPlayerRows(players)}
      <div class="boxscore-row">
        <span class="muted">Player Line Sum</span>
        <strong>${fmt(submitted)}</strong>
      </div>
      ${mismatch ? `
        <div class="boxscore-row">
          <span class="muted">Note</span>
          <strong>Official score and player lines do not match</strong>
        </div>
      ` : ''}
    </div>
  `;
}

function renderGameDetails(game) {
  const final = isFinal(game);
  const win = winner(game);
  const diff = Math.abs(Number(game.teamAScore || 0) - Number(game.teamBScore || 0));
  const box = game.boxScore || {};

  const allPlayers = [...(box.teamA || []), ...(box.teamB || [])];
  const topPlayer = allPlayers.length
    ? [...allPlayers].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0]
    : null;

  return `
    <div class="boxscore-card">
      <div class="boxscore-team">
        <span>${escapeHtml(game.week)} Box Score</span>
        <span>${final ? 'Final' : escapeHtml(game.note || 'Upcoming')}</span>
      </div>
      <div class="boxscore-row"><span>Matchup</span><strong>${teamLink(game.teamA)} vs ${teamLink(game.teamB)}</strong></div>
      <div class="boxscore-row"><span>Score</span><strong>${fmt(game.teamAScore)} to ${fmt(game.teamBScore)}</strong></div>
      <div class="boxscore-row"><span>Winner</span><strong>${win ? escapeHtml(win) : 'None'}</strong></div>
      <div class="boxscore-row"><span>Margin</span><strong>${fmt(diff)}</strong></div>
      <div class="boxscore-row"><span>Top Player</span><strong>${topPlayer ? `${playerLink(topPlayer.handle)} · ${fmt(topPlayer.upvotes)}` : 'Not entered'}</strong></div>
      <div class="boxscore-row"><span>Date</span><strong>${escapeHtml(game.date)}</strong></div>
      <div class="boxscore-row"><span>Type</span><strong>${escapeHtml(game.type)}</strong></div>
      ${game.boxScore?.note ? `<p class="note" style="margin-top:10px">${escapeHtml(game.boxScore.note)}</p>` : ''}
    </div>

    <div class="grid two">
      ${renderTeamBox(game.teamA, game.teamAScore, box.teamA)}
      ${renderTeamBox(game.teamB, game.teamBScore, box.teamB)}
    </div>
  `;
}
