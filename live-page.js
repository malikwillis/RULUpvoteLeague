loadLeagueData().then(data => {
  pageHeader(data, 'live.html', 'Live', 'Scores', 'Official Match Center');
  pageFooter(data);
  activateTabs();
  const nextGames = data.games.filter(g => !isFinal(g) && g.note !== 'Event');
  const liveTarget = $('#live-scoring');
  if(nextGames.length){
    liveTarget.innerHTML = nextGames.slice(0, 6).map(g => renderGameCard(g, data)).join('');
  }else{
    liveTarget.innerHTML = '<div class="empty">No upcoming games are currently listed.</div>';
  }
  const grouped = groupBy(data.games, 'week');
  $('#schedule-content').innerHTML = Object.entries(grouped).map(([week, games]) => `<div class="schedule-group"><div class="schedule-date">${escapeHtml(week)}</div>${games.map(g => `<div class="schedule-row"><span class="sched-team">${teamLink(g.teamA)}</span><span class="sched-vs">VS</span><span class="sched-team right">${teamLink(g.teamB)}</span><span class="pill">${escapeHtml(g.date)}</span></div>`).join('')}</div>`).join('');
  $('#history-content').innerHTML = data.games.filter(isFinal).slice().reverse().map(g => renderGameCard(g, data)).join('') || '<div class="empty">No finals yet.</div>';
  document.addEventListener('click', event => {
    const card = event.target.closest('.live-row-item');
    if(!card) return;
    const label = card.dataset.game;
    const game = data.games.find(g => `${g.week} ${g.teamA} ${g.teamB}` === label);
    if(!game) return;
    const final = isFinal(game), win = winner(game);
    $('#game-details').innerHTML = `<div class="boxscore-card"><div class="boxscore-team"><span>${teamLink(game.teamA)}</span><span>${final ? fmt(game.teamAScore) : '0'}</span></div><div class="boxscore-row"><span>Status</span><span>${escapeHtml(game.note || (final ? 'Final' : 'Upcoming'))}</span></div><div class="boxscore-row"><span>Winner</span><span>${win ? escapeHtml(win) : 'None'}</span></div></div><div class="boxscore-card"><div class="boxscore-team"><span>${teamLink(game.teamB)}</span><span>${final ? fmt(game.teamBScore) : '0'}</span></div><div class="boxscore-row"><span>Week</span><span>${escapeHtml(game.week)}</span></div><div class="boxscore-row"><span>Date</span><span>${escapeHtml(game.date)}</span></div><div class="boxscore-row"><span>Type</span><span>${escapeHtml(game.type)}</span></div></div>`;
    $('#game-modal').classList.add('open');
  });
  document.addEventListener('click', event => { if(event.target.matches('[data-close="true"]')) $('#game-modal').classList.remove('open'); });
});
