import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { INITIAL_ROSTERS } from '../data.js';
import { INITIAL_PICKS } from '../capital-data.js';
import { SEED_GAMES } from '../season-seed.js';
import { HISTORICAL_TRADES } from '../history-seed.js';
import { getAdminApp, HttpError } from './access.mjs';
export const emptyState = () => ({ revision: 0, accessRevision: 0, accessRequests: {}, gmAssignments: {}, commissionerAssignments: {}, games: structuredClone(SEED_GAMES), lineups: {}, rosters: structuredClone(INITIAL_ROSTERS), picks: structuredClone(INITIAL_PICKS), trades: structuredClone(HISTORICAL_TRADES) });

export function createFileStore(file) {
  let queue = Promise.resolve();
  async function read() {
    try {
      const state = JSON.parse(await readFile(file, 'utf8'));
      if (!Number.isSafeInteger(state.revision) || !Array.isArray(state.games) || !state.lineups || typeof state.lineups !== 'object') throw new Error('Invalid saved state');
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') return emptyState();
      throw new HttpError(503, 'Saved league data could not be read. Changes are paused to protect it.');
    }
  }
  return {
    read,
    update(change) {
      const operation = queue.then(async () => {
        const next = change(await read());
        await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        const temporary = `${file}.${process.pid}.tmp`;
        await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
        await rename(temporary, file);
        return next;
      });
      queue = operation.catch(() => {});
      return operation;
    }
  };
}

export function sharedStorageReady() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.RUL_FIRESTORE_RULES_CONFIRMED === '1');
}
export function createFirestoreStore() {
  async function ref() {
    if (!sharedStorageReady()) throw new HttpError(503, 'Shared publishing is not connected yet. Your entry has not been saved.');
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore(await getAdminApp());
    return { db, doc: db.collection('rul_redesign_private').doc('season_2026') };
  }
  return {
    async read() { const { doc } = await ref(); const snapshot = await doc.get(); return snapshot.exists ? snapshot.data() : emptyState(); },
    async update(change) {
      const { db, doc } = await ref();
      return db.runTransaction(async tx => {
        const snapshot = await tx.get(doc);
        const next = change(snapshot.exists ? snapshot.data() : emptyState());
        tx.set(doc, next);
        return next;
      });
    }
  };
}
