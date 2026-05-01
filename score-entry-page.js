
loadLeagueData().then(originalData => {
  const saved = localStorage.getItem('RUL_WORKING_DATA');
  const data = saved ? JSON.parse(saved) : originalData;

  pageHeader(data, 'score-entry.html', 'Commissioner', 'Score Entry', 'Select players, enter upvotes, and export updated data');
  pageFooter(data);

  const root = $('#scoreEntryRoot');
  const teams = [...(data.teams || [])].sort((a, b) => a.name.localeCompare(b.name));
  let weeks = [...new Set((data.games || []).map(game => game.week).filter(Boolean))];

  root.innerHTML = `
    <section class="card">
      <h2 class="card-title">RUL Score Entry Tool</h2>
      <p class="muted">Pick a scheduled game, select exactly 4 players from each team, enter their upvotes, and mark the game Live or Final.</p>
      <p class="note">Player dropdowns only show handles. No all time upvotes are shown.</p>
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
      <button class="btn" id="clearPreviewBtn">Clear Local Preview</button>
      <div id="exportStatus"></div>
    </section>

    <section class="card">
      <h2>How It Updates</h2>
      <div class="row"><span>Same device preview</span><strong>Updates live.html immediately after Apply</strong></div>
      <div class="row"><span>Public website update</span><strong>Download static-data.js and replace it on GitHub</strong></div>
      <div class="row"><span>Live status</span><strong>Shows on Live Scores without counting as Final</strong></div>
      <div class="row"><span>Final status</span><strong>Recalculates records</strong></div>
    </section>
  `;

  let selectedGameIndex = -1;
  let workingData = JSON.parse(JSON.stringify(data));

  $('#weekSelect').addEventListener('change', populateGames);
  $('#gameSelect').addEventListener('change', selectGame);
  $('#gameStatus').addEventListener('change', () => {
    updateGameSummary();
    updatePreview();
  });
  $('#addGameBtn').addEventListener('click', addNewGame);
  $('#applyBtn').addEventListener('click', applyScoreToData);
  $('#downloadBtn').addEventListener('click', downloadStaticData);
  $('#copyBtn').addEventListener('click', copyStaticData);
  $('#clearPreviewBtn').addEventListener('click', clearLocalPreview);

  function populateGames() {
    const week = $('#weekSelect').value;
    const games = workingData.games
      .map((game, index) => ({ ...game, index }))
      .filter(game => game.week === week);

    $('#gameSelect').innerHTML = `<option value="">Choose game</option>` + games.map(game => {
      const score = hasScore(game) ? `${fmt(game.teamAScore)} to ${fmt(game.teamBScore)}` : 'No score';
      const status = getStatus(game);
      return `<option value="${game.index}">${escapeHtml(game.teamA)} vs ${escapeHtml(game.teamB)} · ${escapeHtml(score)} · ${escapeHtml(status)}</option>`;
    }).join('');

    selectedGameIndex = -1;
    $('#playerEntryGrid').innerHTML = '';
    $('#gameSummary').innerHTML = '';
    updatePreview();
  }

  function refreshGameSelect() {
    const currentIndex = selectedGameIndex;
    populateGames();
    if (currentIndex >= 0) {
      $('#gameSelect').value = String(currentIndex);
      selectedGameIndex = currentIndex;
      updateGameSummary();
    }
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
    $('#gameStatus').value = getStatus(game) === 'Final' ? 'Final' : getStatus(game) === 'Upcoming' ? 'Upcoming' : 'Live';

    renderPlayerEntry(game);
    loadExistingBoxScore(game);
    updateGameSummary();
    updatePreview();
  }

  function updateGameSummary() {
    if (selectedGameIndex < 0) return;

    const game = workingData.games[selectedGameIndex];
    const status = $('#gameStatus').value || getStatus(game);

    $('#gameSummary').innerHTML = `
      <div class="mini-card" style="margin-top:14px">
        <div class="row"><span>Matchup</span><strong>${teamLink(game.teamA)} vs ${teamLink(game.teamB)}</strong></div>
        <div class="row"><span>Date</span><strong>${escapeHtml(game.date || '')}</strong></div>
        <div class="row"><span>Type</span><strong>${escapeHtml(game.type || '')}</strong></div>
        <div class="row"><span>Current Score</span><strong>${fmt(getPreviewScore('A'))} to ${fmt(getPreviewScore('B'))}</strong></div>
        <div class="row"><span>Status</span><strong>${escapeHtml(status)}</strong></div>
      </div>
    `;
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

    if (!weeks.includes(week)) {
      weeks.push(week);
      weeks = sortWeeks(weeks);
    }

    $('#weekSelect').innerHTML = `<option value="">Choose week</option>` + weeks.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('');
    $('#weekSelect').value = week;
    refreshGameSelect();
    $('#gameSelect').value = String(selectedGameIndex);
    selectGame();
  }

  function renderPlayerEntry(game) {
    $('#playerEntryGrid').innerHTML = `
      ${renderTeamEntry('A', game.teamA)}
      ${renderTeamEntry('B', game.teamB)}
    `;

    $all('.score-input, .player-select, .note-input').forEach(input => {
      input.addEventListener('input', () => {
        updateGameSummary();
        updatePreview();
      });
      input.addEventListener('change', () => {
        updateGameSummary();
        updatePreview();
      });
    });
  }

  function renderTeamEntry(side, teamName) {
    const team = workingData.teams.find(team => team.name === teamName);
    const roster = team ? [...(team.roster || [])].sort((a, b) => cleanHandle(a.handle).localeCompare(cleanHandle(b.handle))) : [];

    return `
      <article class="card" data-side="${side}">
        <h2>${escapeHtml(teamName)}</h2>
        <p class="muted">Select exactly 4 players and enter current upvotes for this game.</p>

        ${[1,2,3,4].map(num => `
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
    players.slice(0, 4).forEach((player, index) => {
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

    for (let num = 1; num <= 4; num++) {
      const handle = cleanHandle($(`.player-select[data-side="${side}"][data-num="${num}"]`)?.value || '');
      const upvotes = Number($(`.score-input[data-side="${side}"][data-num="${num}"]`)?.value || 0);
      const note = $(`.note-input[data-side="${side}"][data-num="${num}"]`)?.value.trim() || '';

      if (!handle && !upvotes) continue;
      if (!handle) continue;

      players.push({ handle, upvotes, note });
    }

    return players;
  }

  function getPreviewScore(side) {
    return collectSide(side).reduce((sum, player) => sum + Number(player.upvotes || 0), 0);
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
    const totalA = getPreviewScore('A');
    const totalB = getPreviewScore('B');

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
        <div class="row"><span>Ready</span><strong>${teamAPlayers.length === 4 && teamBPlayers.length === 4 ? 'Yes' : 'Need exactly 4 players per team'}</strong></div>
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
    const teamAPlayers = collectSide('A');
    const teamBPlayers = collectSide('B');

    if (teamAPlayers.length !== 4 || teamBPlayers.length !== 4) {
      alert('Each team must have exactly 4 players selected.');
      return;
    }

    const uniqueA = new Set(teamAPlayers.map(player => cleanHandle(player.handle).toLowerCase()));
    const uniqueB = new Set(teamBPlayers.map(player => cleanHandle(player.handle).toLowerCase()));

    if (uniqueA.size !== 4 || uniqueB.size !== 4) {
      alert('Each team must have 4 different players. No duplicates.');
      return;
    }

    const totalA = getPreviewScore('A');
    const totalB = getPreviewScore('B');
    const status = $('#gameStatus').value || 'Live';
    const leader = totalA > totalB ? game.teamA : totalB > totalA ? game.teamB : 'Tie';
    const margin = Math.abs(totalA - totalB);

    game.teamAScore = totalA;
    game.teamBScore = totalB;
    game.note = status;
    game.boxScore = {
      teamA: teamAPlayers,
      teamB: teamBPlayers,
      note: status === 'Final'
        ? (leader === 'Tie' ? 'Game ended in a tie' : `${leader} win by ${fmt(margin)}`)
        : (leader === 'Tie' ? 'Live game is tied' : `${leader} currently leads by ${fmt(margin)}`)
    };

    updatePlayerTotalsFromBoxScore(oldBoxScore, game.boxScore);

    if (status === 'Final') {
      recalculateRecordsFromSchedule();
    }

    updateLeagueLabel(status);
    saveLocalPreview();

    $('#exportStatus').innerHTML = `
      <div class="card" style="margin-top:12px">
        <h2>${escapeHtml(status)} Score Applied</h2>
        <p class="note">${escapeHtml(game.teamA)} ${fmt(totalA)} · ${escapeHtml(game.teamB)} ${fmt(totalB)}</p>
        <p class="muted">Live page updates immediately on this device. For everyone else, download static-data.js and upload it to GitHub.</p>
      </div>
    `;

    refreshGameSelect();
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
      const completed = getStatus(game) === 'Final';

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

  function saveLocalPreview() {
    localStorage.setItem('RUL_WORKING_DATA', JSON.stringify(workingData));
  }

  function clearLocalPreview() {
    localStorage.removeItem('RUL_WORKING_DATA');
    $('#exportStatus').innerHTML = '<div class="note" style="margin-top:12px">Local preview cleared. Refresh pages to use GitHub static-data.js again.</div>';
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

    $('#exportStatus').innerHTML = '<div class="note" style="margin-top:12px">Downloaded static-data.js. Upload it to GitHub and replace the old file.</div>';
  }

  async function copyStaticData() {
    try {
      await navigator.clipboard.writeText(makeStaticDataText());
      $('#exportStatus').innerHTML = '<div class="note" style="margin-top:12px">Copied updated static-data.js. Paste it into GitHub over the old file.</div>';
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

function getStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function sortWeeks(weeks) {
  return [...weeks].sort((a, b) => {
    const an = Number(String(a).match(/\d+/)?.[0] || 999);
    const bn = Number(String(b).match(/\d+/)?.[0] || 999);
    return an - bn;
  });
}
