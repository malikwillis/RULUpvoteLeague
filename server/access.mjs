import { COMMISSIONER_EMAIL, FIREBASE_PROJECT_ID } from './config.mjs';
import { getTeam } from '../data.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function roleForIdentity(identity, gmAssignments = {}) {
  if (!identity?.uid || identity.email_verified !== true || identity.firebase?.sign_in_provider !== 'google.com') {
    throw new HttpError(403, 'Sign in with a verified Google account.');
  }
  const email = String(identity.email || '').trim().toLowerCase();
  if (email === COMMISSIONER_EMAIL) return { role: 'commissioner', uid: identity.uid, email, teamId: null };
  const teamId = Object.hasOwn(gmAssignments, identity.uid) ? gmAssignments[identity.uid] : null;
  return { role: getTeam(teamId) ? 'gm' : 'pending', uid: identity.uid, email, teamId: getTeam(teamId) ? teamId : null };
}

let adminApp;
export async function getAdminApp() {
  if (!adminApp) {
    const { initializeApp, cert } = await import('firebase-admin/app');
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      let account;
      try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); } catch { throw new HttpError(503, 'Server sign-in configuration needs attention.'); }
      if (account.project_id !== FIREBASE_PROJECT_ID) throw new HttpError(503, 'Server sign-in configuration needs attention.');
      credential = cert(account);
    }
    adminApp = initializeApp({ projectId: FIREBASE_PROJECT_ID, ...(credential ? { credential } : {}) }, 'rul-league-access');
  }
  return adminApp;
}

export async function verifyGoogleToken(token) {
  try {
    const { getAuth } = await import('firebase-admin/auth');
    // A configured server checks revocation as well as signature, project, issuer and expiry.
    return await getAuth(await getAdminApp()).verifyIdToken(token, Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, 'Your sign-in could not be verified. Sign in again.');
  }
}

export async function authorize(headers, verify = verifyGoogleToken, assignments = null) {
  const value = headers.authorization || '';
  if (!value) return { role: 'guest', uid: null, email: null, teamId: null };
  const match = /^Bearer ([^\s]{1,16000})$/.exec(value);
  if (!match) throw new HttpError(401, 'A valid sign-in is required.');
  if (assignments === null) {
    try { assignments = JSON.parse(process.env.RUL_GM_ASSIGNMENTS || '{}'); } catch { throw new HttpError(503, 'Team access configuration needs attention.'); }
    if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) throw new HttpError(503, 'Team access configuration needs attention.');
  }
  return roleForIdentity(await verify(match[1]), assignments);
}

export function requireCommissioner(actor) {
  if (actor.role !== 'commissioner') throw new HttpError(actor.role === 'guest' ? 401 : 403, 'Only the commissioner can change league scores and data.');
}
export function requireLineupAccess(actor, teamId) {
  if (actor.role !== 'commissioner' && !(actor.role === 'gm' && actor.teamId === teamId)) {
    throw new HttpError(actor.role === 'guest' ? 401 : 403, 'You can only submit a lineup for your assigned team.');
  }
}
