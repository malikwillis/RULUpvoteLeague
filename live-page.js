
loadLeagueData().then(originalData => {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  const data = saved ? JSON.parse(saved) : originalData;

  pageHeader(data, 'live.html', 'Live', 'Scores', 'Official Match Center');
  pageFooter(data);
  activateTabs();

  const liveTarget = $('#live-scoring');
  const liveGames = (data.games || []).filter(game => gameStatus(game) === 'Live');
  const upcomingGames = (data.games || []).filter(game => gameStatus(game) === 'Upcoming');
  const finalGames = (data.games || []).filter(game => gameStatus(game) === 'Final');

  if (liveTarget) {
    if (liveGames.length) {
      liveTarget.innerHTML = liveGames.map(game => renderLiveAwareCard(game)).join('');
    } else if (upcomingGames.length) {
      liveTarget.innerHTML = upcomingGames.slice(0, 6).map(game => renderLiveAwareCard(game)).join('');
    } else {
      liveTarget.innerHTML = '<div class="empty">No live or upcoming games are currently listed.</div>';
    }
  }

  const scheduleTarget = $('#schedule-content');
  if (scheduleTarget) {
    const grouped = groupBy(data.games || [], 'week');
    scheduleTarget.innerHTML = Object.entries(grouped).map(([week, games]) => `
      <div class="schedule-group">
        <div class="schedule-date">${escapeHtml(week)}</div>
        ${games.map(game => `
          <div class="schedule-row live-row-item" data-game="${escapeHtml(gameKey(game))}">
            <span class="sched-team">${teamLink(game.teamA)}</span>
            <span class="sched-vs">VS</span>
            <span class="sched-team right">${teamLink(game.teamB)}</span>
            <span class="pill">${escapeHtml(gameStatus(game))}</span>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  const historyTarget = $('#history-content');
  if (historyTarget) {
    historyTarget.innerHTML = finalGames
      .slice()
      .reverse()
      .map(game => renderLiveAwareCard(game))
      .join('') || '<div class="empty">No finals yet.</div>';
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link) return;

    const card = event.target.closest('.live-row-item');
    if (!card) return;

    const game = (data.games || []).find(g => gameKey(g) === card.dataset.game);
    if (!game) return;

    const details = $('#game-details');
    const modal = $('#game-modal');

    if (details && modal) {
      details.innerHTML = renderGameDetails(game);
      modal.classList.add('open');
    }
  });

  document.addEventListener('click', event => {
    if (event.target.matches('[data-close="true"]') || event.target.id === 'game-modal') {
      $('#game-modal')?.classList.remove('open');
    }
  });
});

function gameKey(game) {
  return `${game.week} ${game.teamA} ${game.teamB}`;
}

function gameStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function hasScore(game) {
  return Number(game.teamAScore || 0) > 0 || Number(game.teamBScore || 0) > 0;
}

function leaderText(game) {
  const a = Number(game.teamAScore || 0);
  const b = Number(game.teamBScore || 0);

  if (a === b) return 'Tied';

  const leader = a > b ? game.teamA : game.teamB;
  const margin = Math.abs(a - b);

  return `${leader} by ${fmt(margin)}`;
}

function renderLiveAwareCard(game) {
  const status = gameStatus(game);
  const aScore = Number(game.teamAScore || 0);
  const bScore = Number(game.teamBScore || 0);
  const aWin = status === 'Final' && aScore > bScore;
  const bWin = status === 'Final' && bScore > aScore;

  let middle = 'Upcoming';
  if (status === 'Live') middle = hasScore(game) ? `Live · ${leaderText(game)}` : 'Live · No score yet';
  if (status === 'Final') middle = leaderText(game);

  let bottom = 'MATCHUP NOT PLAYED YET';
  if (status === 'Live') bottom = game.boxScore ? 'LIVE NOW · CLICK FOR PLAYER UPVOTES' : 'LIVE NOW';
  if (status === 'Final') bottom = game.boxScore ? 'FINAL · CLICK FOR PLAYER UPVOTES' : 'FINAL';

  return `
    <div class="live-row live-row-item ${status === 'Live' ? 'is-live' : ''}" data-game="${escapeHtml(gameKey(game))}">
      <div class="team-side ${aWin ? 'winner' : ''}">
        <span>${teamLink(game.teamA)}</span>
        <strong>${fmt(aScore)}</strong>
      </div>

      <div class="versus">
        <span>VS</span>
        <strong>${escapeHtml(middle)}</strong>
      </div>

      <div class="team-side right ${bWin ? 'winner' : ''}">
        <span>${teamLink(game.teamB)}</span>
        <strong>${fmt(bScore)}</strong>
      </div>

      <div class="game-meta">${escapeHtml(game.week)} • ${escapeHtml(game.date || '')} • ${escapeHtml(game.type || '')}</div>
      <div class="mvp">${escapeHtml(bottom)}</div>
    </div>
  `;
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
  const status = gameStatus(game);
  const aScore = Number(game.teamAScore || 0);
  const bScore = Number(game.teamBScore || 0);
  const diff = Math.abs(aScore - bScore);
  const box = game.boxScore || {};
  const allPlayers = [...(box.teamA || []), ...(box.teamB || [])];
  const topPlayer = allPlayers.length
    ? [...allPlayers].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0))[0]
    : null;

  const winnerLabel = aScore === bScore
    ? 'None'
    : aScore > bScore ? game.teamA : game.teamB;

  return `
    <div class="boxscore-card">
      <div class="boxscore-team">
        <span>${escapeHtml(game.week)} Box Score</span>
        <span>${escapeHtml(status)}</span>
      </div>
      <div class="boxscore-row"><span>Matchup</span><strong>${teamLink(game.teamA)} vs ${teamLink(game.teamB)}</strong></div>
      <div class="boxscore-row"><span>Score</span><strong>${fmt(aScore)} to ${fmt(bScore)}</strong></div>
      <div class="boxscore-row"><span>${status === 'Final' ? 'Winner' : 'Current Leader'}</span><strong>${escapeHtml(winnerLabel)}</strong></div>
      <div class="boxscore-row"><span>Margin</span><strong>${fmt(diff)}</strong></div>
      <div class="boxscore-row"><span>Top Player</span><strong>${topPlayer ? `${playerLink(topPlayer.handle)} · ${fmt(topPlayer.upvotes)}` : 'Not entered'}</strong></div>
      <div class="boxscore-row"><span>Date</span><strong>${escapeHtml(game.date || '')}</strong></div>
      <div class="boxscore-row"><span>Type</span><strong>${escapeHtml(game.type || '')}</strong></div>
      ${game.boxScore?.note ? `<p class="note" style="margin-top:10px">${escapeHtml(game.boxScore.note)}</p>` : ''}
    </div>

    <div class="grid two">
      ${renderTeamBox(game.teamA, game.teamAScore, box.teamA)}
      ${renderTeamBox(game.teamB, game.teamBScore, box.teamB)}
    </div>
  `;
}
