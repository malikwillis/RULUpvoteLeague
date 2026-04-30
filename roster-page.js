loadLeagueData().then(data => {
  pageHeader(data, 'roster.html', 'League', 'Roster', 'Players & GMs');
  pageFooter(data);
  const render = () => {
    const term = normalize($('#search').value);
    $('#rosterGrid').innerHTML = data.teams.map(team => {
      const players = [...team.roster].sort((a,b) => b.upvotes - a.upvotes).filter(p => !term || normalize(team.name).includes(term) || normalize(team.gm).includes(term) || normalize(p.handle).includes(term));
      if(!players.length && term) return '';
      return `<article class="card team-card" style="--team-accent:${escapeHtml(team.accent)}"><h2 class="card-title">${teamLink(team.name)}</h2><p class="muted">GM ${escapeHtml(team.gm)} • ${escapeHtml(team.record)} • ${fmt(team.totalUpvotes)} upvotes</p>${players.map(p => `<div class="row"><span>${playerLink(p.handle)}</span><strong>${fmt(p.upvotes)}</strong></div>`).join('')}</article>`;
    }).join('') || '<div class="empty">No matching roster results.</div>';
  };
  $('#search').addEventListener('input', render);
  render();
});
