loadLeagueData().then(data => {
  pageHeader(data, 'stats.html', 'Player', 'Stats', 'Stats & Leaderboards');
  pageFooter(data);
  const render = () => {
    const term = normalize($('#search').value);
    const sort = $('#sort').value;
    let ps = allPlayers(data).filter(p => !term || normalize(p.handle).includes(term) || normalize(p.team).includes(term));
    if(sort === 'name') ps.sort((a,b) => a.handle.localeCompare(b.handle));
    else if(sort === 'team') ps.sort((a,b) => a.team.localeCompare(b.team) || b.upvotes - a.upvotes);
    else ps.sort((a,b) => b.upvotes - a.upvotes);
    const leaders = allPlayers(data).sort((a,b) => b.upvotes - a.upvotes).slice(0,4);
    $('#leaders').innerHTML = leaders.map((p,i) => `<article class="card"><div class="label">Rank ${i+1}</div><div class="kpi">@${escapeHtml(p.handle)}</div><p class="muted">${fmt(p.upvotes)} upvotes • ${escapeHtml(p.team)}</p></article>`).join('');
    const rows = ps.map((p,i) => [i + 1, playerLink(p.handle), teamLink(p.team), escapeHtml(p.conference), fmt(p.upvotes), Math.round((Number(p.upvotes) / Math.max(1, Number(p.teamTotal))) * 100) + '%']);
    $('#playersTable').innerHTML = `<h2 class="card-title">All Players</h2>` + table(['Rank','Player','Team','Conf','Upvotes','Team Share'], rows);
  };
  $('#search').addEventListener('input', render);
  $('#sort').addEventListener('change', render);
  render();
  $('#recordsGrid').innerHTML = data.records.map(record => `<article class="card"><h2 class="card-title">${escapeHtml(record.title)}</h2>${record.items.map(item => `<div class="row"><span><strong>${item.rank}. ${playerLink(item.player)}</strong><br><span class="muted">${escapeHtml(item.note || '')}</span></span><strong>${escapeHtml(item.value)}</strong></div>`).join('')}</article>`).join('');
});
