import test from 'node:test';
import assert from 'node:assert/strict';
import { roleForIdentity, resolveStoredRole } from './server/access.mjs';
import { createHandler, applyChange } from './server/handler.mjs';
import { emptyState } from './server/store.mjs';
import { getScheduledGame, matchScheduledResult } from './schedule.js';
import { standings } from './core.js';

const identity = (email = 'jmebben18@gmail.com', uid = 'owner') => ({uid, email, email_verified: true, firebase: {sign_in_provider: 'google.com'}});
const owner = roleForIdentity(identity());
const game = {id:'commissioner-test',week:4,date:'2026-09-24',homeTeamId:'bandits',awayTeamId:'dragons',status:'final',scores:[{playerId:'bandits-01',teamId:'bandits',score:100},{playerId:'dragons-01',teamId:'dragons',score:50}]};

test('the permanent owner and delegated commissioners are distinct', () => {
  assert.equal(owner.role, 'commissioner');
  assert.equal(owner.isOwner, true);
  const delegated = roleForIdentity(identity('helper@example.com', 'helper'), {}, {helper: true});
  assert.equal(delegated.role, 'commissioner');
  assert.equal(delegated.isOwner, false);
  assert.equal(resolveStoredRole(delegated, {}, {}).role, 'pending');
});

test('only the permanent owner can grant or remove commissioner access', () => {
  const waiting = {...emptyState(), accessRevision: 1, accessRequests: {helper: {uid:'helper',email:'helper@example.com',status:'pending',teamId:null}}};
  const granted = applyChange(waiting, {action:'set-commissioner',uid:'helper',enabled:true,accessRevision:1}, owner);
  assert.equal(granted.commissionerAssignments.helper, true);
  assert.equal(granted.accessRequests.helper.status, 'commissioner');
  const helper = roleForIdentity(identity('helper@example.com', 'helper'), {}, granted.commissionerAssignments);
  assert.throws(() => applyChange(granted, {action:'set-commissioner',uid:'helper',enabled:false,accessRevision:2}, helper), {status:403});
  const revoked = applyChange(granted, {action:'set-commissioner',uid:'helper',enabled:false,accessRevision:2}, owner);
  assert.equal(revoked.commissionerAssignments.helper, undefined);
  assert.equal(revoked.accessRequests.helper.status, 'pending');
});

async function invoke(handler,{method='GET',resource='state',token,body}={}) {
  let status,payload;
  const req={method,url:`/api/rul?resource=${resource}`,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(body?{'content-type':'application/json'}:{})},body};
  await handler(req,{writeHead(value){status=value;},end(value){payload=JSON.parse(value);}});
  return {status,payload};
}

test('delegated commissioner access works immediately and revocation is enforced', async () => {
  let stored=emptyState();
  const verify=async token=>identity(token==='owner'?'jmebben18@gmail.com':`${token}@example.com`,token);
  const store={read:async()=>structuredClone(stored),update:async change=>(stored=change(stored))};
  const handler=createHandler({local:true,verify,store});
  await invoke(handler,{method:'POST',resource:'join',token:'helper',body:{}});
  assert.equal((await invoke(handler)).payload.commissionerAssignments, undefined);
  assert.equal((await invoke(handler,{method:'POST',token:'owner',body:{action:'set-commissioner',uid:'helper',enabled:true,accessRevision:1}})).status, 200);
  assert.equal((await invoke(handler,{resource:'session',token:'helper'})).payload.actor.role, 'commissioner');
  assert.equal((await invoke(handler,{method:'POST',token:'helper',body:{action:'save-game',revision:0,game}})).status, 200);
  assert.equal((await invoke(handler,{method:'POST',token:'owner',body:{action:'set-commissioner',uid:'helper',enabled:false,accessRevision:2}})).status, 200);
  assert.equal((await invoke(handler,{resource:'session',token:'helper'})).payload.actor.role, 'pending');
  assert.equal((await invoke(handler,{method:'POST',token:'helper',body:{action:'save-game',revision:1,game}})).status, 403);
});

test('GM assignments cannot bypass owner-only commissioner removal', () => {
  const state = {...emptyState(), accessRevision: 3, commissionerAssignments: {helper: true, second: true}, accessRequests: {
    helper: {uid:'helper',email:'helper@example.com',status:'commissioner',teamId:null},
    second: {uid:'second',email:'second@example.com',status:'commissioner',teamId:null},
    waiting: {uid:'waiting',email:'waiting@example.com',status:'pending',teamId:null}
  }};
  const helper = roleForIdentity(identity('helper@example.com', 'helper'), {}, state.commissionerAssignments);
  for (const uid of ['helper', 'second']) {
    for (const teamId of [null, 'dragons']) {
      assert.throws(() => applyChange(state, {action:'approve-gm',uid,teamId,accessRevision:3}, helper), {status:403});
    }
  }
  const approved = applyChange(state, {action:'approve-gm',uid:'waiting',teamId:'dragons',accessRevision:3}, helper);
  assert.equal(approved.gmAssignments.waiting, 'dragons');
  assert.equal(approved.commissionerAssignments.second, true);
  const reassigned = applyChange(state, {action:'approve-gm',uid:'second',teamId:'dragons',accessRevision:3}, owner);
  assert.equal(reassigned.commissionerAssignments.second, undefined);
  assert.equal(reassigned.gmAssignments.second, 'dragons');
  assert.equal(resolveStoredRole(identity('second@example.com','second'), reassigned.gmAssignments, reassigned.commissionerAssignments).role, 'gm');
});

test('promotion removes the old GM assignment and rejects stale or invalid approval requests', () => {
  const state = {...emptyState(), accessRevision: 4, gmAssignments: {helper:'dragons'}, accessRequests: {helper: {uid:'helper',email:'helper@example.com',status:'approved',teamId:'dragons'}}};
  const promote = {action:'set-commissioner',uid:'helper',enabled:true,accessRevision:4};
  const next = applyChange(state, promote, owner);
  assert.equal(next.gmAssignments.helper, undefined);
  assert.equal(next.accessRequests.helper.teamId, null);
  assert.equal(next.accessRevision, 5);
  assert.throws(() => applyChange(next, promote, owner), {status:409});
  assert.throws(() => applyChange(state, {...promote,uid:'unknown'}, owner), {status:400});
  assert.throws(() => applyChange(state, {...promote,enabled:'true'}, owner), {status:400});
  assert.equal(state.gmAssignments.helper, 'dragons');
});

test('access records and unpublished games are visible only to commissioners', async () => {
  const stored = {...emptyState(), games:[{...game,status:'preview'}], commissionerAssignments:{helper:true}, gmAssignments:{manager:'dragons'}, accessRequests:{waiting:{uid:'waiting',email:'private@example.com',status:'pending',teamId:null}}};
  const verify = async token => identity(`${token}@example.com`,token);
  const handler = createHandler({local:true,verify,store:{read:async()=>structuredClone(stored)}});
  for (const token of [undefined,'waiting','manager']) {
    const result = await invoke(handler,{token});
    assert.equal(result.status, 200);
    for (const key of ['accessRevision','accessRequests','gmAssignments','commissionerAssignments']) assert.equal(Object.hasOwn(result.payload,key),false);
    assert.equal(result.payload.games.length, 0);
  }
  const result = await invoke(handler,{token:'helper'});
  assert.equal(result.payload.accessRequests.waiting.email, 'private@example.com');
  assert.equal(result.payload.games.length, 1);
});

test('revocation during a write is checked again inside the transaction', async () => {
  let stored = {...emptyState(), commissionerAssignments:{helper:true}, accessRequests:{helper:{uid:'helper',email:'helper@example.com',status:'commissioner',teamId:null}}};
  const handler = createHandler({local:true,verify:async()=>identity('helper@example.com','helper'),store:{
    read:async()=>structuredClone(stored),
    update:async change=>{
      stored = {...stored, commissionerAssignments:{}, accessRevision:1};
      return (stored=change(stored));
    }
  }});
  const result = await invoke(handler,{method:'POST',token:'helper',body:{action:'save-game',revision:0,game}});
  assert.equal(result.status, 403);
  assert.equal(stored.games.some(saved=>saved.id===game.id), false);
  assert.equal(stored.revision, 0);
});

test('posted finals match their scheduled week even when the actual date changed', () => {
  const fixture = getScheduledGame('2026-w3-02');
  const posted = { ...fixture, date: '2026-09-20', status: 'final' };
  assert.equal(matchScheduledResult(fixture, [posted]), posted);
  assert.equal(matchScheduledResult(fixture, [{ ...posted, week: 1 }]), undefined);
});

test('score saves reject the wrong week and a duplicate matchup on another date', () => {
  assert.throws(() => applyChange(emptyState(), {action:'save-game',revision:0,game:{...game,week:1}}, owner), {status:400});
  const saved = applyChange(emptyState(), {action:'save-game',revision:0,game}, owner);
  assert.throws(() => applyChange(saved, {action:'save-game',revision:1,game:{...game,id:'duplicate-date',date:'2026-09-25'}}, owner), {status:400});
  assert.equal(saved.games.length, 10);
});

test('commissioner can remove an accidental game without losing its backup', () => {
  const state = emptyState();
  const extra = {...state.games.find(g => g.id === '2026-w3-01'),id:'extra-dragons-supersonics',week:1,date:'2026-09-20'};
  state.games.push(extra);
  const before = standings(state.games);
  assert.throws(() => applyChange(state,{action:'delete-game',revision:0,id:extra.id},{role:'gm',teamId:'dragons'}),{status:403});
  const next = applyChange(state,{action:'delete-game',revision:0,id:extra.id},owner);
  assert.equal(next.games.length, state.games.length-1);
  assert.equal(next.deletedGames[0].id, extra.id);
  assert.equal(next.revision, 1);
  assert.notDeepEqual(standings(next.games), before);
  assert.deepEqual(standings(next.games), standings(emptyState().games));
});

test('join refreshes a role granted while the request is in progress', async () => {
  let stored = {...emptyState(),accessRevision:1,accessRequests:{helper:{uid:'helper',email:'helper@example.com',status:'pending',teamId:null}}};
  const handler = createHandler({local:true,verify:async()=>identity('helper@example.com','helper'),store:{
    read:async()=>structuredClone(stored),
    update:async change=>{
      stored = applyChange(stored,{action:'set-commissioner',uid:'helper',enabled:true,accessRevision:1},owner);
      return (stored=change(stored));
    }
  }});
  const result = await invoke(handler,{method:'POST',resource:'join',token:'helper',body:{}});
  assert.equal(result.status, 200);
  assert.equal(result.payload.actor.role, 'commissioner');
  assert.equal(result.payload.actor.isOwner, false);
});

test('only verified Google identities can receive delegated access', () => {
  for (const invalid of [
    {...identity('helper@example.com','helper'),email_verified:false},
    {...identity('helper@example.com','helper'),firebase:{sign_in_provider:'password'}},
    {...identity('helper@example.com','helper'),uid:null}
  ]) assert.throws(() => roleForIdentity(invalid,{}, {helper:true}),{status:403});
});
