loadLeagueData().then(data => {
  pageHeader(data, 'pickem-leaderboard.html', "Pick'em", 'Leaderboard', 'Weekly and season standings');
  pageFooter(data);

  const root = $('#pickemLeaderboardRoot');

  let auth;
  let db;

  try {
    const fb = initRulFirebase();
    auth = fb.auth;
    db = fb.db;
  } catch (error) {
    root.innerHTML = `
      <section class="card">
        <h2>Firebase Setup Needed</h2>
        <p class="muted">${escapeHtml(error.message)}</p>
      </section>
    `;
    return;
  }

  const weeks = pickemWeeks(data);
  let selectedWeek = defaultPickemWeek(data);

  root.innerHTML = `
    <section class="card">
      <div class="row">
        <span>
          <strong>RUL Pick'em Leaderboard</strong><br>
          <span class="muted">Scores update from final games in static-data.js.</span>
        </span>
        <a class="btn" href="pickem.html">Submit Picks</a>
      </div>

      <div class="grid two" style="margin-top:16px">
        <div>
          <label class="label">Leaderboard Type</label>
          <select id="leaderboardType">
            <option value="season">Season</option>
            <option value="week">Weekly</option>
          </select>
        </div>
        <div>
          <label class="label">Week</label>
          <select id="weekSelect">
            ${weeks.map(week => `<option value="${escapeHtml(week)}" ${week === selectedWeek ? 'selected' : ''}>${escapeHtml(week)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div id="leaderboardStatus" class="note" style="margin-top:12px">Loading entries...</div>
      <div id="leaderboardTable"></div>
    </section>

    <section class="card" style="margin-top:16px">
      <h2>Scoring System</h2>
      <p class="muted">Correct winner pick equals 1 point. Wrong pick equals 0 points. Live and upcoming games are not graded yet.</p>
    </section>
  `;

  $('#leaderboardType').addEventListener('change', renderLeaderboard);
  $('#weekSelect').addEventListener('change', event => {
    selectedWeek = event.target.value;
    renderLeaderboard();
  });

  renderLeaderboard();

  async function renderLeaderboard() {
    try {
      $('#leaderboardStatus').textContent = 'Loading entries...';

      const entries = await loadAllPickemEntries(db);
      const type = $('#leaderboardType').value;

      if (type === 'week') {
        renderWeekly(entries);
      } else {
        renderSeason(entries);
      }
    } catch (error) {
      $('#leaderboardStatus').innerHTML = `<p class="muted">${escapeHtml(error.message || 'Leaderboard failed to load.')}</p>`;
    }
  }

  function renderWeekly(entries) {
    const weekEntries = entries
      .filter(entry => entry.week === selectedWeek)
      .map(entry => scorePickemEntry(data, entry))
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(b.correct || 0) - Number(a.correct || 0) || String(a.realUsername).localeCompare(String(b.realUsername)));

    $('#leaderboardStatus').textContent = `${weekEntries.length} entries submitted for ${selectedWeek}`;

    const rows = weekEntries.map((entry, index) => [
      index + 1,
      `@${escapeHtml(entry.realUsername || 'Unknown')}`,
      fmt(entry.score),
      `${fmt(entry.correct)}/${fmt(entry.graded)}`,
      escapeHtml(entry.champion || '')
    ]);

    $('#leaderboardTable').innerHTML = table(['#', 'Name', 'Score', 'Correct', 'Champ'], rows);
  }

  function renderSeason(entries) {
    const season = scoreSeasonEntries(data, entries);

    $('#leaderboardStatus').textContent = `${entries.length} total weekly entries submitted`;

    const rows = season.map((entry, index) => [
      index + 1,
      `@${escapeHtml(entry.realUsername || 'Unknown')}`,
      fmt(entry.score),
      `${fmt(entry.correct)}/${fmt(entry.graded)}`,
      fmt(entry.entries),
      escapeHtml(entry.champion || '')
    ]);

    $('#leaderboardTable').innerHTML = table(['#', 'Name', 'Score', 'Correct', 'Entries', 'Champ'], rows);
  }
}).catch(error => {
  const root = $('#pickemLeaderboardRoot') || document.body;
  root.innerHTML = `<section class="card"><h2>Leaderboard failed to load</h2><p class="muted">${escapeHtml(error.message)}</p></section>`;
});
