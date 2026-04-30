loadLeagueData().then(data => {
  pageHeader(data, 'draft.html', 'Draft', 'Capital', 'Future Assets Tracker');
  pageFooter(data);
  $('#draftBoard').innerHTML = `<h2 class="card-title">Draft Board</h2>` + table(['Line','Round 1','Round 2','Round 3','Round 4','Round 5','Round 6'], data.draftBoard.map(row => row.map(escapeHtml)));
  $('#futurePicks').innerHTML = Object.entries(data.futurePicks).map(([team,picks]) => `<article class="card"><h2 class="card-title">${teamLink(team)}</h2><p class="muted">${picks.length} future assets listed</p>${picks.map(pick => `<div class="row"><span>${escapeHtml(pick)}</span><span class="pill">Pick</span></div>`).join('')}</article>`).join('');
});
