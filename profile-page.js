loadLeagueData().then(data => {
  pageHeader(data, 'profile.html', 'Player', 'Profile', 'Current team, upvotes, previous teams, and trade history');
  pageFooter(data);

  const raw = cleanHandle(new URLSearchParams(location.search).get('player') || '');
  const player = allPlayers(data).find(p => cleanHandle(p.handle).toLowerCase() === raw.toLowerCase());

  if (!player) {
    $('#profileContent').innerHTML = '<div class="empty">Player not found.</div>';
    return;
  }

  const team = data.teams.find(t => t.name === player.team);
  const ranked = allPlayers(data).sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0));
  const rank = ranked.findIndex(p => p.handle === player.handle) + 1;
  const history = data.playerHistory?.[cleanHandle(player.handle)] || player.history || [];
  const previousTeams = [...new Set(history.map(h => h.from).filter(Boolean))];
  const movementLabel = previousTeams.length ? previousTeams.join(' → ') + ' → ' + player.team : 'No previous RUL team listed';

  const teamShare = team && Number(team.totalUpvotes || 0)
    ? Math.round((Number(player.upvotes || 0) / Number(team.totalUpvotes || 1)) * 100)
    : 0;

  $('#profileContent').innerHTML = `
    <section class="profile-hero card">
      <div class="avatar">${escapeHtml(cleanHandle(player.handle).slice(0, 1).toUpperCase())}</div>
      <div>
        <div class="label">RUL Player Profile</div>
        <h1 class="profile-name">@${escapeHtml(cleanHandle(player.handle))}</h1>
        <p class="muted">Current Team: ${teamLink(player.team)} · ${fmt(player.upvotes)} upvotes</p>
      </div>
    </section>

    <section class="grid four">
      <article class="card">
        <div class="label">Current Team</div>
        <div class="kpi">${escapeHtml(player.team)}</div>
      </article>
      <article class="card">
        <div class="label">Previous Team</div>
        <div class="kpi">${previousTeams.length ? escapeHtml(previousTeams[previousTeams.length - 1]) : 'None'}</div>
      </article>
      <article class="card">
        <div class="label">Upvotes</div>
        <div class="kpi">${fmt(player.upvotes)}</div>
      </article>
      <article class="card">
        <div class="label">League Rank</div>
        <div class="kpi">#${rank}</div>
      </article>
    </section>

    <section class="grid two">
      <article class="card">
        <h2>Team Movement</h2>
        <div class="row">
          <span>Path</span>
          <strong>${escapeHtml(movementLabel)}</strong>
        </div>
        <div class="row">
          <span>Team Share</span>
          <strong>${teamShare}% of ${escapeHtml(player.team)} official total</strong>
        </div>
        <p class="note">Official team totals stay locked to the standings total. Traded player upvotes do not move backward into the new team total.</p>
      </article>

      <article class="card">
        <h2>Transaction History</h2>
        ${history.length ? history.map(h => `
          <div class="row">
            <span>
              <strong>${escapeHtml(h.week)}</strong><br>
              <span class="muted">${escapeHtml(h.title)}</span>
            </span>
            <strong>${escapeHtml(h.from)} → ${escapeHtml(h.to)}</strong>
          </div>
        `).join('') : '<div class="empty">No trade history listed.</div>'}
      </article>
    </section>
  `;
});
