function rulPickemFirebaseReady() {
  return !!(window.firebase && window.RUL_FIREBASE_CONFIG && window.RUL_FIREBASE_CONFIG.apiKey && !window.RUL_FIREBASE_CONFIG.apiKey.includes('PASTE_'));
}

function initRulFirebase() {
  if (!rulPickemFirebaseReady()) {
    throw new Error('Firebase is not configured yet. Fill out firebase-config.js first.');
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(window.RUL_FIREBASE_CONFIG);
  }

  return {
    auth: firebase.auth(),
    db: firebase.firestore()
  };
}

function pickemSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pickemGameId(game) {
  return pickemSlug(`${game.week}_${game.teamA}_vs_${game.teamB}`);
}

function pickemStatus(game) {
  const note = String(game.note || '').trim().toLowerCase();
  if (note === 'final') return 'Final';
  if (note === 'live') return 'Live';
  return 'Upcoming';
}

function pickemWinner(game) {
  if (pickemStatus(game) !== 'Final') return null;

  const a = Number(game.teamAScore || 0);
  const b = Number(game.teamBScore || 0);

  if (a === b) return null;
  return a > b ? game.teamA : game.teamB;
}

function weekNumberForPickem(week) {
  const match = String(week || '').match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function pickemWeeks(data) {
  return [...new Set((data.games || []).map(game => game.week).filter(Boolean))]
    .filter(week => !String(week).toLowerCase().includes('all star'))
    .filter(week => weekNumberForPickem(week) >= 5)
    .sort((a, b) => weekNumberForPickem(a) - weekNumberForPickem(b));
}

function gamesForWeek(data, week) {
  return (data.games || []).filter(game => {
    const isRealTeamA = (data.teams || []).some(team => team.name === game.teamA);
    const isRealTeamB = (data.teams || []).some(team => team.name === game.teamB);
    return game.week === week && isRealTeamA && isRealTeamB;
  });
}

function defaultPickemWeek(data) {
  const weeks = pickemWeeks(data);
  const liveOrUpcoming = weeks.find(week => gamesForWeek(data, week).some(game => pickemStatus(game) !== 'Final'));
  return liveOrUpcoming || weeks[0] || 'Week 5';
}

async function getUserProfile(db, uid) {
  const snap = await db.collection('rul_pickem_users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function saveUserProfile(db, user, username) {
  const clean = String(username || '').replace(/^@/, '').trim();

  if (!clean || clean.length < 2) {
    throw new Error('Enter a valid Real username.');
  }

  if (clean.length > 32) {
    throw new Error('Username is too long.');
  }

  await db.collection('rul_pickem_users').doc(user.uid).set({
    uid: user.uid,
    realUsername: clean,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return clean;
}

function pickDocId(uid, week) {
  return `${uid}_${pickemSlug(week)}`;
}

async function saveWeeklyPicks(db, user, profile, week, picks, champion) {
  const weekSlug = pickemSlug(week);

  await db.collection('rul_pickem_picks').doc(pickDocId(user.uid, week)).set({
    uid: user.uid,
    week,
    weekSlug,
    realUsername: profile.realUsername,
    picks,
    champion: champion || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    submittedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function loadUserWeeklyPicks(db, uid, week) {
  const snap = await db.collection('rul_pickem_picks').doc(pickDocId(uid, week)).get();
  return snap.exists ? snap.data() : null;
}

async function loadAllPickemEntries(db) {
  const snap = await db.collection('rul_pickem_picks').get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function scorePickemEntry(data, entry) {
  const games = gamesForWeek(data, entry.week);
  let score = 0;
  let correct = 0;
  let graded = 0;

  games.forEach(game => {
    const winner = pickemWinner(game);
    if (!winner) return;

    graded += 1;

    const gameId = pickemGameId(game);
    const picked = entry.picks?.[gameId];

    if (picked === winner) {
      score += 1;
      correct += 1;
    }
  });

  return {
    ...entry,
    score,
    correct,
    graded,
    possible: games.length
  };
}

function scoreSeasonEntries(data, entries) {
  const byUser = {};

  entries.forEach(entry => {
    const scored = scorePickemEntry(data, entry);
    const key = entry.uid || entry.realUsername;

    if (!byUser[key]) {
      byUser[key] = {
        uid: entry.uid,
        realUsername: entry.realUsername || 'Unknown',
        score: 0,
        correct: 0,
        graded: 0,
        entries: 0,
        champion: entry.champion || ''
      };
    }

    byUser[key].score += scored.score;
    byUser[key].correct += scored.correct;
    byUser[key].graded += scored.graded;
    byUser[key].entries += 1;

    if (entry.champion) byUser[key].champion = entry.champion;
  });

  return Object.values(byUser).sort((a, b) => {
    return Number(b.score || 0) - Number(a.score || 0)
      || Number(b.correct || 0) - Number(a.correct || 0)
      || String(a.realUsername).localeCompare(String(b.realUsername));
  });
}

function renderPickemStatusPill(status) {
  if (status === 'Final') return '<span class="pill">Final</span>';
  if (status === 'Live') return '<span class="pill">Live</span>';
  return '<span class="pill">Open</span>';
}
