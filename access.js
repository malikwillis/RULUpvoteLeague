import {applyRosterState} from './data.js';
// Roles come only from the authenticated server response; browser storage never grants access.
let firebaseAuth;
let sdk;
let initPromise;
let config = null;
let actor = { role: 'guest', uid: null, email: null, teamId: null, isOwner: false };
let state = { revision: 0, games: [], lineups: {} };
let ready = false;
let error = '';
const listeners = new Set();
const emit = kind => listeners.forEach(listener => listener(kind));
export const access = () => ({ actor, ready, error, config });
export const leagueState = () => state;
export const isCommissioner = () => actor.role === 'commissioner';
export const canSubmitLineups = () => ['commissioner', 'gm'].includes(actor.role);
export const onAccessChange = listener => { listeners.add(listener); return () => listeners.delete(listener); };

async function request(resource, body) {
  const headers = {};
  if (firebaseAuth?.currentUser) headers.Authorization = `Bearer ${await firebaseAuth.currentUser.getIdToken()}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api/rul?resource=${resource}`, {method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store'});
  let data;
  try { data = await response.json(); } catch { throw new Error('The league service is not connected. Please try again later.'); }
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

export async function refreshLeague() {
  const next = await request('state');
  if (!Number.isSafeInteger(next.revision) || !Array.isArray(next.games) || !next.lineups) throw new Error('League data could not be loaded.');
  state = next;
  applyRosterState(state.rosters);
  emit('state');
  return next;
}
export async function saveLeagueGame(game) {
  if (!isCommissioner()) throw new Error('Commissioner sign-in is required.');
  state = await request('state', {action: 'save-game', revision: state.revision, game});
  emit('state');
}
export async function deleteLeagueGame(id) {
  if (!isCommissioner()) throw new Error('Commissioner sign-in is required.');
  state = await request('state', {action: 'delete-game', revision: state.revision, id});
  emit('state');
}
export async function saveLeagueLineup(lineup) {
  if (!canSubmitLineups()) throw new Error('Sign in with an assigned GM account.');
  state = await request('state', {action: 'save-lineup', revision: state.revision, lineup});
  emit('state');
}

export async function initializeAccess() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      config = await request('config');
      await refreshLeague().catch(e => { error = e.message; });
      const [app, authSDK] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js')
      ]);
      sdk = authSDK;
      firebaseAuth = sdk.getAuth(app.initializeApp(config.firebase, 'rul-redesign'));
      await sdk.setPersistence(firebaseAuth, sdk.browserSessionPersistence);
      sdk.onIdTokenChanged(firebaseAuth, async user => {
        ready = false;
        // Immediately remove the previous account's privileges during any account transition.
        actor = {role: 'guest', uid: null, email: null, teamId: null, isOwner: false};
        state = {...state, games: state.games.filter(game => game.status === 'final')};
        emit('auth');
        try {
          actor = user ? (await request('join', {})).actor : actor;
          await refreshLeague();
          error = '';
        } catch (e) { error = e.message; }
        ready = true;
        emit('auth');
      });
    } catch (e) {
      error = e.message || 'Sign-in is temporarily unavailable.';
      ready = true;
      emit('auth');
    }
  })();
  return initPromise;
}
export async function signIn() {
  await initializeAccess();
  if (!firebaseAuth || !sdk) throw new Error(error || 'Sign-in is not ready. Reload and try again.');
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt: 'select_account'});
  try { await sdk.signInWithPopup(firebaseAuth, provider); }
  catch (e) {
    const messages = {
      'auth/popup-closed-by-user': 'Sign-in was cancelled. You can try again.',
      'auth/popup-blocked': 'Allow the Google sign-in popup, then try again.',
      'auth/unauthorized-domain': 'Google sign-in is not enabled for this preview address yet.',
      'auth/operation-not-allowed': 'Google sign-in needs to be enabled for the league.'
    };
    throw new Error(messages[e.code] || 'Google sign-in could not be completed. Please try again.');
  }
}
export async function signOut() {
  if (firebaseAuth) await sdk.signOut(firebaseAuth);
  actor = {role: 'guest', uid: null, email: null, teamId: null, isOwner: false};
  state = {...state, games: state.games.filter(game => game.status === 'final')};
  emit('auth');
}

export async function checkApproval() {
  actor=(await request('session')).actor;
  await refreshLeague();
  emit('auth');
}
export async function approveGM(uid, teamId) {
  if(!isCommissioner())throw new Error('Commissioner access is required.');
  state=await request('state',{action:'approve-gm',uid,teamId,accessRevision:state.accessRevision||0});
  emit('state');
}

export async function setCommissioner(uid, enabled) {
  if(!isCommissioner() || access().actor.isOwner !== true)throw new Error('Only the league owner can grant commissioner access.');
  state=await request('state',{action:'set-commissioner',uid,enabled,accessRevision:state.accessRevision||0});
  emit('state');
}

export async function applyLeagueTrade(text, revision) {
  if(!isCommissioner())throw new Error('Commissioner access is required.');
  state=await request('state',{action:'apply-trade',text,revision});
  applyRosterState(state.rosters);
  emit('state');
}
