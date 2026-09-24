import { authorize, resolveStoredRole, requireCommissioner, requireOwnerCommissioner, requireLineupAccess, HttpError } from './access.mjs';
import { FIREBASE_CLIENT_CONFIG } from './config.mjs';
import { createFirestoreStore, sharedStorageReady } from './store.mjs';
import { validateGame } from '../core.js';
import { validateLineup } from '../lineups.js';
import { parseTradeText } from '../trade-core.js';
import { randomUUID } from 'node:crypto';
import { getTeam } from '../data.js';
import { getWeekMatchups } from '../schedule.js';

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
};
const publicState = (state, actor) => ({revision: state.revision, games: actor.role === 'commissioner' ? state.games : state.games.filter(g => g.status === 'final'), lineups: state.lineups, rosters: state.rosters, picks: state.picks, trades: state.trades, ...(actor.role==='commissioner'?{accessRevision:state.accessRevision||0,accessRequests:state.accessRequests||{},gmAssignments:state.gmAssignments||{},commissionerAssignments:state.commissionerAssignments||{}}:{})});
async function bodyOf(req) {
  if (req.body !== undefined) {
    if (JSON.stringify(req.body).length > 100000) throw new HttpError(413, 'This entry is too large.');
    try { return typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { throw new HttpError(400, 'Invalid entry.'); }
  }
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 100000) throw new HttpError(413, 'This entry is too large.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid entry.'); }
}

export function applyChange(state, body, actor) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid entry.');
  // Authorize the requested action before examining revision or stored records.
  if (body.action === 'set-commissioner') {
    requireOwnerCommissioner(actor);
    if (body.accessRevision !== (state.accessRevision||0)) throw new HttpError(409, 'Account approvals changed. Refresh before trying again.');
    if (typeof body.uid !== 'string' || !Object.hasOwn(state.accessRequests||{},body.uid)) throw new HttpError(400, 'Select an account that has requested access.');
    if (typeof body.enabled !== 'boolean') throw new HttpError(400, 'Choose whether this account should have commissioner access.');
    const next=structuredClone(state);
    next.gmAssignments??={};
    next.commissionerAssignments??={};
    delete next.gmAssignments[body.uid];
    if(body.enabled)next.commissionerAssignments[body.uid]=true;else delete next.commissionerAssignments[body.uid];
    next.accessRequests[body.uid]={...next.accessRequests[body.uid],status:body.enabled?'commissioner':'pending',teamId:null,updatedAt:new Date().toISOString()};
    next.accessRevision=(state.accessRevision||0)+1;
    return next;
  }
  if (body.action === 'approve-gm') {
    requireCommissioner(actor);
    if (body.accessRevision !== (state.accessRevision||0)) throw new HttpError(409, 'Account approvals changed. Refresh before trying again.');
    if (typeof body.uid !== 'string' || !Object.hasOwn(state.accessRequests||{},body.uid)) throw new HttpError(400, 'Select an account that has requested access.');
    if (body.teamId !== null && !getTeam(body.teamId)) throw new HttpError(400, 'Choose a valid team.');
    // Assigning a GM also removes commissioner status, so it needs the same
    // owner-only permission as an explicit commissioner revocation.
    if (state.commissionerAssignments?.[body.uid] === true) requireOwnerCommissioner(actor);
    if (body.teamId && Object.entries(state.gmAssignments||{}).some(([uid,team])=>uid!==body.uid&&team===body.teamId)) throw new HttpError(409, 'That team already has a GM. Remove the existing assignment first.');
    const next=structuredClone(state);
    next.gmAssignments??={};
    next.commissionerAssignments??={};
    delete next.commissionerAssignments[body.uid];
    if(body.teamId)next.gmAssignments[body.uid]=body.teamId;else delete next.gmAssignments[body.uid];
    next.accessRequests[body.uid]={...next.accessRequests[body.uid],status:body.teamId?'approved':'pending',teamId:body.teamId,updatedAt:new Date().toISOString()};
    next.accessRevision=(state.accessRevision||0)+1;
    return next;
  }
  if (['save-game','apply-trade'].includes(body.action)) requireCommissioner(actor);
  else if (body.action === 'save-lineup') requireLineupAccess(actor, body.lineup?.teamId);
  else throw new HttpError(400, 'Unknown action.');
  if (!Number.isSafeInteger(body.revision) || body.revision !== state.revision) throw new HttpError(409, 'League data changed in another window. Reload the latest data before saving; your entry is still here.');
  const next = structuredClone(state);
  if (body.action === 'apply-trade') {
    const parsed=parseTradeText(body.text,state);
    if(parsed.errors.length)throw new HttpError(400,parsed.errors.join(' '));
    for(const move of parsed.transfers){
      if(move.kind==='player'){
        next.rosters[move.id]=move.toTeamId;
        for(const [key,lineup] of Object.entries(next.lineups)){
          const alreadyPlayed=next.games.some(game=>game.status==='final'&&game.week===lineup.week&&[game.homeTeamId,game.awayTeamId].includes(lineup.teamId));
          if(!alreadyPlayed&&lineup.playerIds.includes(move.id))next.lineups[key]={...lineup,playerIds:lineup.playerIds.filter(id=>id!==move.id),needsUpdate:true};
        }
      }else next.picks.find(p=>p.id===move.id).ownerTeamId=move.toTeamId;
    }
    // Keep pre-trade game rosters immutable, including older saved previews.
    for(const game of next.games)game.rosterSnapshot??=Object.fromEntries(game.scores.map(row=>[row.playerId,row.teamId]));
    next.trades.push({id:randomUUID(),title:parsed.participants.map(id=>getTeam(id).name).join(' / '),text:body.text,transfers:parsed.transfers,createdAt:new Date().toISOString(),historical:false});
  } else if (body.action === 'save-game') {
    const raw = body.game;
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.scores) || raw.scores.length > 62 || typeof raw.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(raw.id)) throw new HttpError(400, 'Invalid game.');
    const game = {id: raw.id, season: '2026', week: raw.week, date: raw.date, homeTeamId: raw.homeTeamId, awayTeamId: raw.awayTeamId, status: raw.status, scores: raw.scores.map(row => ({playerId: row?.playerId, teamId: row?.teamId, score: row?.score}))};
    const previous = state.games.find(g => g.id === game.id);
    game.rosterSnapshot = previous?.rosterSnapshot && previous.homeTeamId === game.homeTeamId && previous.awayTeamId === game.awayTeamId ? previous.rosterSnapshot : {...state.rosters};
    if (previous?.sourceNote) game.sourceNote = previous.sourceNote;
    const errors = validateGame(game);
    if (next.games.some(g => g.id !== game.id && g.week === game.week && g.date === game.date && [g.homeTeamId, g.awayTeamId].sort().join('|') === [game.homeTeamId, game.awayTeamId].sort().join('|'))) errors.push('This matchup already has a result. Edit that result instead.');
    if (errors.length) throw new HttpError(400, errors.join(' '));
    if (next.games.length >= 200 && !next.games.some(g => g.id === game.id)) throw new HttpError(400, 'The season game limit has been reached.');
    next.games = next.games.filter(g => g.id !== game.id).concat(game);
  } else {
    const raw = body.lineup;
    const lineup = {teamId: raw.teamId, week: raw.week, playerIds: raw.playerIds, submittedAt: new Date().toISOString()};
    const errors = validateLineup(lineup, {rosters:state.rosters});
    if (!getWeekMatchups(lineup.week).some(g => [g.homeTeamId, g.awayTeamId].includes(lineup.teamId))) errors.push('Choose a scheduled week for this team.');
    if (errors.length) throw new HttpError(400, errors.join(' '));
    next.lineups[`${lineup.teamId}:${lineup.week}`] = lineup;
  }
  next.revision += 1;
  return next;
}

export function createHandler({store = createFirestoreStore(), verify, assignments, local = false} = {}) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const resource = url.searchParams.get('resource') || 'state';
      if (req.method === 'GET' && resource === 'config') return send(res, 200, {firebase: FIREBASE_CLIENT_CONFIG, storage: local ? 'local' : 'shared', storageReady: local || sharedStorageReady()});
      if (!['GET', 'POST'].includes(req.method)) throw new HttpError(405, 'Method not allowed.');
      let actor = await authorize(req.headers, verify, {}, {});
      const current = await store.read();
      actor=resolveStoredRole(actor,assignments||current.gmAssignments||{},current.commissionerAssignments||{});
      if (req.method === 'GET' && resource === 'session') return send(res, 200, {actor});
      if (req.method === 'GET' && resource === 'state') return send(res, 200, publicState(current, actor));
      if (req.method === 'POST' && resource === 'join') {
        if(actor.role==='guest')throw new HttpError(401,'Sign in with Google first.');
        let joinedState = current;
        if(actor.role==='pending')joinedState=await store.update(state=>{
          if(Object.hasOwn(state.accessRequests||{},actor.uid))return state;
          if(Object.keys(state.accessRequests||{}).length>=200)throw new HttpError(429,'The account request limit has been reached. Contact the commissioner.');
          return {...state,accessRevision:(state.accessRevision||0)+1,accessRequests:{...state.accessRequests,[actor.uid]:{uid:actor.uid,email:actor.email,status:'pending',teamId:null,requestedAt:new Date().toISOString()}}};
        });
        return send(res,200,{actor:resolveStoredRole(actor,assignments||joinedState.gmAssignments||{},joinedState.commissionerAssignments||{})});
      }
      if (req.method !== 'POST' || resource !== 'state') throw new HttpError(404, 'Not found.');
      if (!['commissioner', 'gm'].includes(actor.role)) throw new HttpError(actor.role === 'guest' ? 401 : 403, 'Sign in with an account that has editing permission.');
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Use a JSON request.');
      const body = await bodyOf(req);
      // Reject wrong-team and score writes before opening the store transaction.
      if (body?.action === 'set-commissioner') requireOwnerCommissioner(actor);
      else if (['save-game','approve-gm','apply-trade'].includes(body?.action)) requireCommissioner(actor);
      if (body?.action === 'save-lineup') requireLineupAccess(actor, body.lineup?.teamId);
      const state = await store.update(current => {
        // Recheck assignments inside the transaction so a concurrent revocation takes effect.
        const currentActor = resolveStoredRole(actor,assignments||current.gmAssignments||{},current.commissionerAssignments||{});
        return applyChange(current, body, currentActor);
      });
      const updatedActor = resolveStoredRole(actor,assignments||state.gmAssignments||{},state.commissionerAssignments||{});
      return send(res, 200, publicState(state, updatedActor));
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('RUL request failed:', error.code || error.name);
      send(res, error.status || 503, {error: error.status ? error.message : 'The league service is unavailable. Your changes have not been saved.'});
    }
  };
}
export default createHandler();
