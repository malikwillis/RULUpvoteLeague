loadLeagueData().then(data => {
  pageHeader(data, 'pickem.html', "RUL", "Pick'em", 'Sign in with Google and pick weekly winners');
  pageFooter(data);

  const root = $('#pickemRoot');

  let auth;
  let db;
  let currentUser = null;
  let currentProfile = null;
  let currentWeek = defaultPickemWeek(data);

  try {
    const fb = initRulFirebase();
    auth = fb.auth;
    db = fb.db;
  } catch (error) {
    root.innerHTML = renderSetupError(error.message);
    return;
  }

  root.innerHTML = `
    <section class="card">
      <h2 class="card-title">RUL Pick'em</h2>
      <p class="muted">Sign in with Google. Then save your Real username. Then pick the winners for one week at a time.</p>
      <div id="authBox"></div>
    </section>

    <section id="usernameBox"></section>
    <section id="pickemBox"></section>
  `;

  auth.getRedirectResult().catch(error => {
    const authBox = $('#authBox');
    if (authBox) {
      authBox.innerHTML = `
        <div class="card">
          <h2>Google Sign In Error</h2>
          <p class="muted">${escapeHtml(error.message || 'Google sign in failed.')}</p>
        </div>
      `;
    }
  });

  auth.onAuthStateChanged(async user => {
    currentUser = user || null;

    if (!currentUser) {
      currentProfile = null;
      renderSignedOut();
      $('#usernameBox').innerHTML = '';
      $('#pickemBox').innerHTML = '';
      return;
    }

    currentProfile = await getUserProfile(db, currentUser.uid);
    renderSignedIn();
    renderUsernameSetup();

    if (currentProfile) {
      await renderPickemForm();
    } else {
      $('#pickemBox').innerHTML = `
        <section class="card" style="margin-top:16px">
          <h2>Step 2</h2>
          <p class="muted">Save your Real username above to unlock weekly picks.</p>
        </section>
      `;
    }
  });

  function renderSignedOut() {
    $('#authBox').innerHTML = `
      <button class="btn" id="googleLoginBtn">Sign in with Google</button>
      <a class="btn" href="pickem-leaderboard.html">View Leaderboard</a>
      <p class="muted" style="margin-top:12px">Step 1: sign in. Step 2: save username. Step 3: pick Week 5 games.</p>
    `;

    $('#googleLoginBtn').addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithRedirect(provider);
    });
  }

  function renderSignedIn() {
    $('#authBox').innerHTML = `
      <div class="row">
        <span>
          <strong>${escapeHtml(currentUser.displayName || currentUser.email || 'Signed in')}</strong><br>
          <span class="muted">${escapeHtml(currentUser.email || '')}</span>
        </span>
        <button class="btn" id="signOutBtn">Sign Out</button>
      </div>
      <a class="btn" href="pickem-leaderboard.html">View Leaderboard</a>
    `;

    $('#signOutBtn').addEventListener('click', () => auth.signOut());
  }

  function renderUsernameSetup() {
    $('#usernameBox').innerHTML = `
      <section class="card" style="margin-top:16px">
        <h2 class="card-title">Step 2: Real Username</h2>
        <p class="muted">Type your Real username once. Your Google account will stay linked to this username.</p>
        <div class="grid two">
          <input id="realUsername" placeholder="Example: malikwillis" value="${escapeHtml(currentProfile?.realUsername || '')}">
          <button class="btn" id="saveUsernameBtn">Save Username</button>
        </div>
        <div id="usernameStatus"></div>
      </section>
    `;

    $('#saveUsernameBtn').addEventListener('click', async () => {
      try {
        const name = await saveUserProfile(db, currentUser, $('#realUsername').value);
        currentProfile = await getUserProfile(db, currentUser.uid);
        $('#usernameStatus').innerHTML = `<p class="note">Saved as @${escapeHtml(name)}.</p>`;
        await renderPickemForm();
      } catch (error) {
        $('#usernameStatus').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
      }
    });
  }

  async function renderPickemForm() {
    if (!currentProfile) return;

    const weeks = pickemWeeks(data);
    const weekGames = gamesForWeek(data, currentWeek);
    const existing = await loadUserWeeklyPicks(db, currentUser.uid, currentWeek);
    const savedPicks = existing?.picks || {};

    $('#pickemBox').innerHTML = `
      <section class="card" style="margin-top:16px">
        <div class="row">
          <span>
            <strong>Step 3: Submit Picks</strong><br>
            <span class="muted">Logged in as @${escapeHtml(currentProfile.realUsername)}</span>
          </span>
          <span class="pill">${escapeHtml(currentWeek)}</span>
        </div>

        <label class="label">Week</label>
        <select id="weekSelect">
          ${weeks.map(week => `<option value="${escapeHtml(week)}" ${week === currentWeek ? 'selected' : ''}>${escapeHtml(week)}</option>`).join('')}
        </select>

        <div id="gamesPickList" style="margin-top:16px">
          ${weekGames.map(game => renderGamePick(game, savedPicks[pickemGameId(game)])).join('') || '<div class="empty">No games listed for this week.</div>'}
        </div>

        <label class="label">Champion Pick Optional</label>
        <select id="championPick">
          <option value="">No champion pick</option>
          ${(data.teams || []).map(team => `<option value="${escapeHtml(team.name)}" ${existing?.champion === team.name ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('')}
        </select>

        <button class="btn" id="submitPicksBtn">Submit Picks</button>
        <div id="pickSubmitStatus"></div>
      </section>
    `;

    $('#weekSelect').addEventListener('change', async event => {
      currentWeek = event.target.value;
      await renderPickemForm();
    });

    $('#submitPicksBtn').addEventListener('click', submitPicks);
  }

  function renderGamePick(game, selected) {
    const id = pickemGameId(game);
    const status = pickemStatus(game);
    const locked = status === 'Final';

    return `
      <article class="mini-card" style="margin-bottom:12px">
        <div class="row">
          <span>
            <strong>${teamLink(game.teamA)} vs ${teamLink(game.teamB)}</strong><br>
            <span class="muted">${escapeHtml(game.week)} · ${escapeHtml(game.date || '')} · ${escapeHtml(game.type || '')}</span>
          </span>
          ${renderPickemStatusPill(status)}
        </div>

        <select class="winnerPick" data-game-id="${escapeHtml(id)}" ${locked ? 'disabled' : ''}>
          <option value="">Choose winner</option>
          <option value="${escapeHtml(game.teamA)}" ${selected === game.teamA ? 'selected' : ''}>${escapeHtml(game.teamA)}</option>
          <option value="${escapeHtml(game.teamB)}" ${selected === game.teamB ? 'selected' : ''}>${escapeHtml(game.teamB)}</option>
        </select>

        ${locked ? `<p class="muted">This game is final. Winner: ${escapeHtml(pickemWinner(game) || 'None')}</p>` : ''}
      </article>
    `;
  }

  async function submitPicks() {
    try {
      const picks = {};
      let missing = 0;

      $all('.winnerPick').forEach(select => {
        if (!select.disabled) {
          if (!select.value) missing += 1;
          else picks[select.dataset.gameId] = select.value;
        } else if (select.value) {
          picks[select.dataset.gameId] = select.value;
        }
      });

      if (missing > 0) {
        $('#pickSubmitStatus').innerHTML = `<p class="muted">Pick every open game before submitting.</p>`;
        return;
      }

      await saveWeeklyPicks(db, currentUser, currentProfile, currentWeek, picks, $('#championPick').value);

      $('#pickSubmitStatus').innerHTML = `
        <div class="card" style="margin-top:12px">
          <h2>Picks Submitted</h2>
          <p class="note">@${escapeHtml(currentProfile.realUsername)} submitted picks for ${escapeHtml(currentWeek)}.</p>
          <a class="btn" href="pickem-leaderboard.html">View Leaderboard</a>
        </div>
      `;
    } catch (error) {
      $('#pickSubmitStatus').innerHTML = `<p class="muted">${escapeHtml(error.message || 'Picks failed to submit.')}</p>`;
    }
  }
}).catch(error => {
  const root = $('#pickemRoot') || document.body;
  root.innerHTML = `<section class="card"><h2>Pick'em failed to load</h2><p class="muted">${escapeHtml(error.message)}</p></section>`;
});

function renderSetupError(message) {
  return `
    <section class="card">
      <h2>Firebase Setup Needed</h2>
      <p class="muted">${escapeHtml(message)}</p>
      <p class="muted">Open firebase-config.js and paste your Firebase web app config.</p>
    </section>
  `;
}
