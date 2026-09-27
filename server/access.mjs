import { COMMISSIONER_EMAIL, FIREBASE_PROJECT_ID } from './config.mjs';
import { getTeam } from '../data.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function resolveStoredRole(actor, gmAssignments = {}, commissionerAssignments = {}) {
  if (!actor?.uid) return { role: 'guest', uid: null, email: null, teamId: null, isOwner: false };
  const isOwner = actor.email === COMMISSIONER_EMAIL;
  if (isOwner || commissionerAssignments[actor.uid] === true) return { ...actor, role: 'commissioner', teamId: null, isOwner };
  const teamId = Object.hasOwn(gmAssignments, actor.uid) ? gmAssignments[actor.uid] : null;
  return { ...actor, role: getTeam(teamId) ? 'gm' : 'pending', teamId: getTeam(teamId) ? teamId : null, isOwner: false };
}

export function roleForIdentity(identity, gmAssignments = {}, commissionerAssignments = {}) {
  if (!identity?.uid || identity.email_verified !== true || identity.firebase?.sign_in_provider !== 'google.com') {
    throw new HttpError(403, 'Sign in with a verified Google account.');
  }
  const email = String(identity.email || '').trim().toLowerCase();
  return resolveStoredRole({ role: 'pending', uid: identity.uid, email, teamId: null, isOwner: false }, gmAssignments, commissionerAssignments);
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

const TOKEN_VERIFICATION_ERROR_CODES = new Set([
  'auth/argument-error',
  'auth/certificate-fetch-failed',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/insufficient-permission',
  'auth/internal-error',
  'auth/invalid-credential',
  'auth/invalid-id-token',
  'auth/invalid-project-id',
  'auth/project-not-found',
  'auth/tenant-id-mismatch',
  'auth/user-disabled',
  'auth/user-not-found',
  'app/internal-error',
  'app/invalid-app-options',
  'app/invalid-credential',
  'app/network-error',
  'app/network-timeout',
  'ERR_MODULE_NOT_FOUND',
  'MODULE_NOT_FOUND',
  'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'ERR_PACKAGE_IMPORT_NOT_DEFINED',
  'ERR_REQUIRE_ESM',
  'ERR_REQUIRE_ASYNC_MODULE',
  'ERR_UNSUPPORTED_DIR_IMPORT',
  'ERR_UNSUPPORTED_ESM_URL_SCHEME',
  'ERR_UNKNOWN_FILE_EXTENSION',
  'ERR_INVALID_PACKAGE_CONFIG',
  'ERR_INVALID_PACKAGE_TARGET',
  'ERR_INVALID_MODULE_SPECIFIER',
  'ERR_INVALID_ARG_TYPE',
  'ERR_DLOPEN_FAILED',
  'ENOENT',
  'EACCES',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET'
]);
const TOKEN_VERIFICATION_ERROR_NAMES = new Set([
  'Error', 'TypeError', 'SyntaxError', 'ReferenceError', 'RangeError',
  'FirebaseAuthError', 'FirebaseAppError'
]);

export async function verifyGoogleToken(token) {
  let stage = 'loading-auth';
  try {
    const { getAuth } = await import('firebase-admin/auth');
    stage = 'initializing-app';
    const app = await getAdminApp();
    stage = 'initializing-auth';
    const auth = getAuth(app);
    stage = 'verifying-token';
    // A configured server checks revocation as well as signature, project, issuer and expiry.
    return await auth.verifyIdToken(token, Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // Every value is a local enum. Never log SDK messages, stacks, tokens, or identity.
    console.error(JSON.stringify({
      stage,
      code: TOKEN_VERIFICATION_ERROR_CODES.has(error?.code) ? error.code : 'auth/unknown-error',
      name: TOKEN_VERIFICATION_ERROR_NAMES.has(error?.name) ? error.name : 'UnknownError'
    }));
    throw new HttpError(401, 'Your sign-in could not be verified. Sign in again.');
  }
}

export async function authorize(headers, verify = verifyGoogleToken, assignments = null, commissionerAssignments = null) {
  const value = headers.authorization || '';
  if (!value) return { role: 'guest', uid: null, email: null, teamId: null, isOwner: false };
  const match = /^Bearer ([^\s]{1,16000})$/.exec(value);
  if (!match) throw new HttpError(401, 'A valid sign-in is required.');
  if (assignments === null) {
    try { assignments = JSON.parse(process.env.RUL_GM_ASSIGNMENTS || '{}'); } catch { throw new HttpError(503, 'Team access configuration needs attention.'); }
    if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) throw new HttpError(503, 'Team access configuration needs attention.');
  }
  if (commissionerAssignments === null) commissionerAssignments = {};
  if (!commissionerAssignments || typeof commissionerAssignments !== 'object' || Array.isArray(commissionerAssignments)) throw new HttpError(503, 'Commissioner access configuration needs attention.');
  return roleForIdentity(await verify(match[1]), assignments, commissionerAssignments);
}

export function requireCommissioner(actor) {
  if (actor.role !== 'commissioner') throw new HttpError(actor.role === 'guest' ? 401 : 403, 'Only the commissioner can change league scores and data.');
}
export function requireOwnerCommissioner(actor) {
  if (actor.role !== 'commissioner' || actor.isOwner !== true) throw new HttpError(actor.role === 'guest' ? 401 : 403, 'Only the league owner can change commissioner access.');
}
export function requireLineupAccess(actor, teamId) {
  if (actor.role !== 'commissioner' && !(actor.role === 'gm' && actor.teamId === teamId)) {
    throw new HttpError(actor.role === 'guest' ? 401 : 403, 'You can only submit a lineup for your assigned team.');
  }
}
