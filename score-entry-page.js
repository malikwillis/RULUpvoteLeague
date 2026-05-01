
loadLeagueData().then(data => {
  pageHeader(data, 'score-entry.html', 'Commissioner', 'Score Entry', 'Select players, enter upvotes, and export updated data');
  pageFooter(data);

  const root = $('#scoreEntryRoot');
  const teams = [...(data.teams || [])].sort((a, b) => a.name.localeCompare(b.name));
  const weeks = [...new Set((data.games || []).map(game => game.week).filter(Boolean))];

  root.innerHTML = `
    <section class="card">
      <h2 class="card-title">RUL Score Entry Tool</h2>
      <p class="muted">Pick a scheduled game, select the players who played, enter their upvotes, and the tool calculates the score automatically.</p>
      <p class="note">Dropdowns now only show player handles. All time upvotes are hidden from the player selector.</p>
    </section>

    <section class="grid two">
      <article class="card">
        <h2>Choose Scheduled Game</h2>
        <label class="label">Week</label>
        <select id="weekSelect">
          <option value="">Choose week</option>
          ${weeks.map(week => `<option value="${escapeHtml(week)}">${escapeHtml(week)}</option>`).join('')}
        </select>

        <label class="label">Game</label>
        <select id="gameSelect">
          <option value="">Choose a week first</option>
        </select>

        <label class="label">Game Status</label>
        <select id="gameStatus">
          <option value="Live">Live right now</option>
          <option value="Final">Final</option>
          <option value="Upcoming">Upcoming</option>
        </select>

        <div id="gameSummary"></div>
      </article>

      <article class="card">
        <h2>Or Add New Game</h2>
        <p class="muted">Use this only if the matchup is not already in the schedule.</p>

        <label class="label">Week</label>
        <input id="newWeek" placeholder="Week 5">

        <label class="label">Date</label>
        <input id="newDate" placeholder="Fri, May 1">

        <label class="label">Team A</label>
        <select id="newTeamA">
          <option value="">Choose team</option>
          ${teams.map(team => `<option value="${escapeHtml(team.name)}">${escapeHtml(team.name)}</option>`).join('')}
        </select>

        <label class="label">Team B</label>
        <select id="newTeamB">
          <option value="">Choose team</option>
          ${teams.map(team => `<option value="${escapeHtml(team.name)}">${escapeHtml(team.name)}</option>`).join('')}
        </select>

        <label class="label">Game Type</label>
        <select id="newType">
          <option>Non Conf</option>
          <option>East</option>
          <option>West</option>
        </select>

        <button class="btn" id="addGameBtn">Add Game To Editor</button>
      </article>
    </section>

    <section class="grid two" id="playerEntryGrid"></section>

    <section class="card">
      <h2>Score Preview</h2>
      <div id="scorePreview" class="empty">Choose a game and enter player upvotes.</div>
      <button class="btn" id="applyBtn">Apply Score To Data</button>
      <button class="btn" id="downloadBtn">Download Updated static-data.js</button>
      <button class="btn" id="copyBtn">Copy Updated static-data.js</button>
      <div id="exportStatus"></div>
    </section>

    <section class="card">
      <h2>How To Use</h2>
      <div class="row"><span>1. Select week and game</span><strong>Example: Week 5</strong></div>
      <div class="row"><span>2. Set game status</span><strong>Live or Final</strong></div>
      <div class="row"><span>3. Pick players who played</span><strong>Handles only</strong></div>
      <div class="row"><span>4. Type player upvotes</span><strong>Total calculates itself</strong></div>
      <div class="row"><span>5. Download static-data.js</span><strong>Replace it on GitHub</strong></div>
    </section>
  `;

  let selectedGameIndex = -1;
  let workingData = JSON.parse(JSON.stringify(data));

  $('#weekSelect').addEventListener('change', populateGames);
  $('#gameSelect').addEventListener('change', selectGame);
  $('#gameStatus').addEventListener('change', updatePreview);
  $('#addGameBtn').addEventListener('click', addNewGame);
  $('#applyBtn').addEventListener('click', applyScoreToData);
  $('#downloadBtn').addEventListener('click', downloadStaticData);
  $('#copyBtn').addEventListener('click', copyStaticData);

  function populateGames() {
    const week = $('#weekSelect').value;
    const games = workingData.games
      .map((game, index) => ({ ...game, index }))
      .filter(game => game.week === week);

    $('#gameSelect').innerHTML = `<option value="">Choose game</option>` + games.map(game => {
      const score = hasScore(game) ? ` · ${fmt(game.teamAScore)} to ${fmt(game.teamBScore)}` : ' · No score';
      const status = game.note ? ` · ${game.note}` : '';
      return `<option value="${game.index}">${escapeHtml(game.teamA)} vs ${escapeHtml(game.teamB)}${score}${escapeHtml(status)}</option>`;
    }).join('');

    selectedGameIndex = -1;
    $('#playerEntryGrid').innerHTML = '';
    $('#gameSummary').innerHTML = '';
    updatePreview();
  }

  function selectGame() {
    selectedGameIndex = Number($('#gameSelect').value);
    if (Number.isNaN(selectedGameIndex) || selectedGameIndex < 0) {
      $('#playerEntryGrid').innerHTML = '';
      $('#gameSummary').innerHTML = '';
      updatePreview();
      return;
    }

    const game = workingData.games[selectedGameIndex];

    if (String(game.note || '').toLowerCase() === 'final') $('#gameStatus').value = 'Final';
    else if (String(game.note || '').toLowerCase() === 'live') $('#gameStatus').value = 'Live';
    else $('#gameStatus').value = 'Live';

    $('#gameSummary').innerHTML = `
      <div class="mini-card" style="margin-top:14px">
        <div class="row"><span>Matchup</span><strong>${teamLink(game.teamA)} vs ${teamLink(game.teamB)}</strong></div>
        <div class="row"><span>Date</span><strong>${escapeHtml(game.date || '')}</strong></div>
        <div class="row"><span>Type</span><strong>${escapeHtml(game.type || '')}</strong></div>
        <div class="row"><span>Current Score</span><strong>${fmt(game.teamAScore || 0)} to ${fmt(game.teamBScore || 0)}</strong></div>
        <div class="row"><span>Status</span><strong>${escapeHtml(game.note || 'Upcoming')}</strong></div>
      </div>
    `;

    renderPlayerEntry(game);
    loadExistingBoxScore(game);
    updatePreview();
  }

  function addNewGame() {
    const week = $('#newWeek').value.trim();
    const date = $('#newDate').value.trim();
    const teamA = $('#newTeamA').value;
    const teamB = $('#newTeamB').value;
    const type = $('#newType').value;

    if (!week || !teamA || !teamB || teamA === teamB) {
      alert('Enter a week and choose two different teams.');
      return;
    }

    const game = {
      week,
      date,
      teamA,
      teamB,
      type,
      teamAScore: 0,
      teamBScore: 0,
      note: 'Live'
    };

    workingData.games.push(game);
    selectedGameIndex = workingData.games.length - 1;

    if (!weeks.includes(week)) weeks.push(week);

    $('#weekSelect').innerHTML = `<option value="">Choose week</option>` + weeks.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('');
    $('#weekSelect').value = week;
    populateGames();
    $('#gameSelect').value = String(selectedGameIndex);
    selectGame();
  }

  function renderPlayerEntry(game) {
    $('#playerEntryGrid').innerHTML = `
      ${renderTeamEntry('A', game.teamA)}
      ${renderTeamEntry('B', game.teamB)}
    `;

    $all('.score-input, .player-select, .note-input').forEach(input => {
      input.addEventListener('input', updatePreview);
      input.addEventListener('change', updatePreview);
    });
  }

  function renderTeamEntry(side, teamName) {
    const team = workingData.teams.find(team => team.name === teamName);
    const roster = team ? [...(team.roster || [])].sort((a, b) => cleanHandle(a.handle).localeCompare(cleanHandle(b.handle))) : [];

    return `
      <article class="card" data-side="${side}">
        <h2>${escapeHtml(teamName)}</h2>
        <p class="muted">Select players who played and enter their upvotes.</p>

        ${[1,2,3,4,5,6].map(num => `
          <div class="grid two player-line" data-side="${side}" data-num="${num}">
            <div>
              <label class="label">Player ${num}</label>
              <select class="player-select" data-side="${side}" data-num="${num}">
                <option value="">Not used</option>
                ${roster.map(player => `<option value="${escapeHtml(cleanHandle(player.handle))}">@${escapeHtml(cleanHandle(player.handle))}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="label">Upvotes</label>
              <input class="score-input" data-side="${side}" data-num="${num}" type="number" min="0" placeholder="0">
            </div>
            <div style="grid-column: 1 / -1">
              <input class="note-input" data-side="${side}" data-num="${num}" placeholder="Note, optional. Example: C, A, penalty">
            </div>
          </div>
        `).join('')}

        <div class="mini-card">
          <div class="row"><span>${escapeHtml(teamName)} Total</span><strong id="team${side}Total">0</strong></div>
        </div>
      </article>
    `;
  }

  function loadExistingBoxScore(game) {
    const box = game.boxScore || {};
    fillSide('A', box.teamA || []);
    fillSide('B', box.teamB || []);
  }

  function fillSide(side, players) {
    players.forEach((player, index) => {
      const num = index + 1;
      const select = $(`.player-select[data-side="${side}"][data-num="${num}"]`);
      const score = $(`.score-input[data-side="${side}"][data-num="${num}"]`);
      const note = $(`.note-input[data-side="${side}"][data-num="${num}"]`);

      if (select) select.value = cleanHandle(player.handle);
      if (score) score.value = Number(player.upvotes || 0);
      if (note) note.value = player.note || '';
    });
  }

  function collectSide(side) {
    const players = [];

    for (let num = 1; num <= 6; num++) {
      const handle = cleanHandle($(`.player-select[data-side="${side}"][data-num="${num}"]`)?.value || '');
      const upvotes = Number($(`.score-input[data-side="${side}"][data-num="${num}"]`)?.value || 0);
      const note = $(`.note-input[data-side="${side}"][data-num="${num}"]`)?.value.trim() || '';

      if (!handle && !upvotes) continue;
      if (!handle) continue;

      players.push({ handle, upvotes, note });
    }

    return players;
  }

  function updatePreview() {
    if (selectedGameIndex < 0) {
      $('#scorePreview').innerHTML = '<div class="empty">Choose a game and enter player upvotes.</div>';
      return;
    }

    const game = workingData.games[selectedGameIndex];
    const status = $('#gameStatus').value || 'Live';
    const teamAPlayers = collectSide('A');
    const teamBPlayers = collectSide('B');
    const totalA = teamAPlayers.reduce((sum, player) => sum + Number(player.upvotes || 0), 0);
    const totalB = teamBPlayers.reduce((sum, player) => sum + Number(player.upvotes || 0), 0);

    const leader = totalA > totalB ? game.teamA : totalB > totalA ? game.teamB : 'Tie';
    const margin = Math.abs(totalA - totalB);

    const teamATotal = $('#teamATotal');
    const teamBTotal = $('#teamBTotal');

    if (teamATotal) teamATotal.textContent = fmt(totalA);
    if (teamBTotal) teamBTotal.textContent = fmt(totalB);

    $('#scorePreview').innerHTML = `
      <div class="grid two">
        <div class="mini-card">
          <div class="label">${escapeHtml(game.teamA)}</div>
          <div class="kpi">${fmt(totalA)}</div>
          <p class="muted">${teamAPlayers.length} players entered</p>
        </div>
        <div class="mini-card">
          <div class="label">${escapeHtml(game.teamB)}</div>
          <div class="kpi">${fmt(totalB)}</div>
          <p class="muted">${teamBPlayers.length} players entered</p>
        </div>
      </div>
      <div class="mini-card" style="margin-top:12px">
        <div class="row"><span>Status</span><strong>${escapeHtml(status)}</strong></div>
        <div class="row"><span>${status === 'Final' ? 'Winner' : 'Current Leader'}</span><strong>${escapeHtml(leader)}</strong></div>
        <div class="row"><span>Margin</span><strong>${fmt(margin)}</strong></div>
        <div class="row"><span>Ready</span><strong>${teamAPlayers.length && teamBPlayers.length ? 'Yes' : 'Add players first'}</strong></div>
      </div>
    `;
  }

  function applyScoreToData() {
    if (selectedGameIndex < 0) {
      alert('Choose a game first.');
      return;
    }

    const game = workingData.games[selectedGameIndex];
    const oldBoxScore = JSON.parse(JSON.stringify(game.boxScore || {}));
    const oldStatus = String(game.note || '').toLowerCase();
    const newStatus = $('#gameStatus').value || 'Live';
    const teamAPlayers = collectSide('A');
    const teamBPlayers = collectSide('B');

    if (!teamAPlayers.length || !teamBPlayers.length) {
      alert('Enter at least one player for each team.');
      return;
    }

    const totalA = teamAPlayers.reduce((sum, player) => sum + Number(player.upvotes || 0), 0);
    const totalB = teamBPlayers.reduce((sum, player) => sum + Number(player.upvotes || 0), 0);
    const leader = totalA > totalB ? game.teamA : totalB > totalA ? game.teamB : 'Tie';
    const margin = Math.abs(totalA - totalB);

    game.teamAScore = totalA;
    game.teamBScore = totalB;
    game.note = newStatus;
    game.boxScore = {
      teamA: teamAPlayers,
      teamB: teamBPlayers,
      note: newStatus === 'Final'
        ? (leader === 'Tie' ? 'Game ended in a tie' : `${leader} win by ${fmt(margin)}`)
        : (leader === 'Tie' ? 'Live game is tied' : `${leader} currently leads by ${fmt(margin)}`)
    };

    if (oldStatus !== 'live' && newStatus.toLowerCase() === 'live') {
      updatePlayerTotalsFromBoxScore({}, game.boxScore);
    } else if (oldStatus === 'live' && newStatus.toLowerCase() === 'live') {
      updatePlayerTotalsFromBoxScore(oldBoxScore, game.boxScore);
    } else if (oldStatus === 'live' && newStatus.toLowerCase() === 'final') {
      updatePlayerTotalsFromBoxScore(oldBoxScore, game.boxScore);
    } else if (oldStatus !== 'final' && newStatus.toLowerCase() === 'final') {
      updatePlayerTotalsFromBoxScore(oldBoxScore, game.boxScore);
    } else {
      updatePlayerTotalsFromBoxScore(oldBoxScore, game.boxScore);
    }

    if (newStatus === 'Final') {
      recalculateRecordsFromSchedule();
    }

    updateLeagueLabel(newStatus);

    $('#exportStatus').innerHTML = `
      <div class="card" style="margin-top:12px">
        <h2>${escapeHtml(newStatus)} Score Applied</h2>
        <p class="note">${escapeHtml(game.teamA)} ${fmt(totalA)} · ${escapeHtml(game.teamB)} ${fmt(totalB)}</p>
        <p class="muted">Now download or copy the updated static-data.js and upload it to GitHub.</p>
      </div>
    `;

    updatePreview();
  }

  function updatePlayerTotalsFromBoxScore(oldBoxScore, newBoxScore) {
    subtractBox(oldBoxScore.teamA || []);
    subtractBox(oldBoxScore.teamB || []);
    addBox(newBoxScore.teamA || []);
    addBox(newBoxScore.teamB || []);
  }

  function subtractBox(players) {
    players.forEach(player => {
      const rosterPlayer = findRosterPlayer(player.handle);
      if (rosterPlayer) {
        rosterPlayer.upvotes = Math.max(0, Number(rosterPlayer.upvotes || 0) - Number(player.upvotes || 0));
      }
    });
  }

  function addBox(players) {
    players.forEach(player => {
      const rosterPlayer = findRosterPlayer(player.handle);
      if (rosterPlayer) {
        rosterPlayer.upvotes = Number(rosterPlayer.upvotes || 0) + Number(player.upvotes || 0);
      }
    });
  }

  function findRosterPlayer(handle) {
    const target = cleanHandle(handle).toLowerCase();

    for (const team of workingData.teams || []) {
      for (const player of team.roster || []) {
        if (cleanHandle(player.handle).toLowerCase() === target) {
          return player;
        }
      }
    }

    return null;
  }

  function recalculateRecordsFromSchedule() {
    const records = {};

    (workingData.teams || []).forEach(team => {
      records[team.name] = { wins: 0, losses: 0, confWins: 0, confLosses: 0, conference: team.conference };
    });

    (workingData.games || []).forEach(game => {
      const aScore = Number(game.teamAScore || 0);
      const bScore = Number(game.teamBScore || 0);
      const completed = String(game.note || '').toLowerCase() === 'final';

      if (!completed || aScore === bScore) return;
      if (!records[game.teamA] || !records[game.teamB]) return;

      const aWin = aScore > bScore;
      const winner = aWin ? game.teamA : game.teamB;
      const loser = aWin ? game.teamB : game.teamA;

      records[winner].wins += 1;
      records[loser].losses += 1;

      if (isConferenceGame(game, records[game.teamA].conference, records[game.teamB].conference)) {
        records[winner].confWins += 1;
        records[loser].confLosses += 1;
      }
    });

    (workingData.teams || []).forEach(team => {
      const record = records[team.name];
      if (!record) return;
      team.record = `${record.wins}-${record.losses}`;
      team.conferenceRecord = `${record.confWins}-${record.confLosses}`;
    });
  }

  function isConferenceGame(game, confA, confB) {
    const type = String(game.type || '').toLowerCase();
    if (type.includes('non')) return false;
    if (confA && confB && String(confA).toLowerCase() === String(confB).toLowerCase()) return true;
    if (type.includes('east') || type.includes('west') || type.includes('conf')) return true;
    return false;
  }

  function updateLeagueLabel(status) {
    const week = workingData.games[selectedGameIndex]?.week || '';
    workingData.league = workingData.league || {};
    if (status === 'Live') {
      workingData.league.updatedLabel = week ? `${week} live scoring` : 'Live scoring';
    } else if (status === 'Final') {
      workingData.league.updatedLabel = week ? `Updated through ${week}` : 'Updated with final score';
    } else {
      workingData.league.updatedLabel = 'Updated with upcoming matchup';
    }
  }

  function makeStaticDataText() {
    return 'window.RUL_STATIC_DATA = ' + JSON.stringify(workingData, null, 2) + ';\n';
  }

  function downloadStaticData() {
    const blob = new Blob([makeStaticDataText()], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'static-data.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    $('#exportStatus').innerHTML = `
      <div class="note" style="margin-top:12px">Downloaded static-data.js. Upload it to GitHub and replace the old file.</div>
    `;
  }

  async function copyStaticData() {
    try {
      await navigator.clipboard.writeText(makeStaticDataText());
      $('#exportStatus').innerHTML = `
        <div class="note" style="margin-top:12px">Copied updated static-data.js. Paste it into GitHub over the old file.</div>
      `;
    } catch {
      $('#exportStatus').innerHTML = `
        <div class="card" style="margin-top:12px">
          <h2>Copy Failed</h2>
          <p class="muted">Your browser blocked clipboard access. Use the download button instead.</p>
        </div>
      `;
    }
  }
}).catch(error => {
  console.error('Score entry failed:', error);
  const root = document.querySelector('#scoreEntryRoot') || document.body;
  root.innerHTML = `
    <section class="card">
      <h2>Score Entry Failed To Load</h2>
      <p class="muted">${escapeHtml(error.message || 'Check that all site files are uploaded.')}</p>
    </section>
  `;
});

function hasScore(game) {
  return Number(game.teamAScore || 0) > 0 || Number(game.teamBScore || 0) > 0;
}
