loadLeagueData().then(data => {
  pageHeader(data, 'profile.html', 'Player', 'Profile', 'Current team, upvotes, previous teams, and trade history');
  pageFooter(data);

  const root = $('#profileRoot') || $('#profileContent') || document.querySelector('main') || document.body;
  const raw = cleanHandle(new URLSearchParams(location.search).get('player') || '');

  const players = allPlayers(data).map(player => ({
    ...player,
    handle: cleanHandle(player.handle)
  }));

  if (!raw) {
    renderPlayerDirectory(root, data, players);
    return;
  }

  const player = players.find(p => cleanHandle(p.handle).toLowerCase() === raw.toLowerCase());

  if (!player) {
    root.innerHTML = `
      <section class="card">
        <h2>Player not found</h2>
        <p class="muted">That player is not in the current RUL data file.</p>
        <a class="btn" href="profile.html">View All Players</a>
      </section>
    `;
    return;
  }

  renderPlayerProfile(root, data, player, players);
}).catch(error => {
  console.error('Profile page failed:', error);
  const root = document.querySelector('#profileRoot') || document.querySelector('main') || document.body;
  root.innerHTML = `
    <section class="card">
      <h2>Profile failed to load</h2>
      <p class="muted">Check that static-data.js, utils.js, data-service.js, layout.js, and profile-page.js are uploaded in the main repo folder.</p>
    </section>
  `;
});

function renderPlayerDirectory(root, data, players) {
  const sorted = [...players].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0));

  root.innerHTML = `
    <section class="card">
      <h2 class="card-title">Player Directory</h2>
      <p class="muted">Tap any player to open their profile.</p>
      <input class="search" id="profileSearch" placeholder="Search player or team">
      <div id="profileDirectory"></div>
    </section>
  `;

  function draw() {
    const term = normalize($('#profileSearch')?.value || '');
    const filtered = sorted.filter(player => {
      if (!term) return true;
      return normalize(player.handle).includes(term)
        || normalize(player.team).includes(term)
        || normalize(player.conference).includes(term);
    });

    $('#profileDirectory').innerHTML = filtered.map((player, index) => `
      <a class="row" href="profile.html?player=${slug('@' + cleanHandle(player.handle))}">
        <span>
          <strong>${index + 1}. @${escapeHtml(cleanHandle(player.handle))}</strong><br>
          <span class="muted">${escapeHtml(player.team)} · ${escapeHtml(player.conference || '')}</span>
        </span>
        <strong>${fmt(player.upvotes)}</strong>
      </a>
    `).join('') || '<div class="empty">No players found.</div>';
  }

  $('#profileSearch').addEventListener('input', draw);
  draw();
}

function renderPlayerProfile(root, data, player, players) {
  const team = data.teams.find(t => t.name === player.team);
  const ranked = [...players].sort((a, b) => Number(b.upvotes || 0) - Number(a.upvotes || 0));
  const rank = ranked.findIndex(p => cleanHandle(p.handle) === cleanHandle(player.handle)) + 1;

  const history = data.playerHistory?.[cleanHandle(player.handle)] || player.history || [];
  const previousTeams = [...new Set(history.map(h => h.from).filter(Boolean))];

  const movementLabel = previousTeams.length
    ? `${previousTeams.join(' → ')} → ${player.team}`
    : 'No previous RUL team listed';

  const officialTotal = Number(team?.totalUpvotes || 0);
  const teamShare = officialTotal
    ? Math.round((Number(player.upvotes || 0) / officialTotal) * 100)
    : 0;

  root.innerHTML = `
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
              <strong>${escapeHtml(h.week || h.date || 'Recent')}</strong><br>
              <span class="muted">${escapeHtml(h.title || 'Trade')}</span>
            </span>
            <strong>${escapeHtml(h.from || '')} → ${escapeHtml(h.to || '')}</strong>
          </div>
        `).join('') : '<div class="empty">No trade history listed.</div>'}
      </article>
    </section>

    <section class="card">
      <a class="btn" href="profile.html">View All Players</a>
      <a class="btn" href="${teamUrl(player.team)}">View Team</a>
    </section>
  `;
}
