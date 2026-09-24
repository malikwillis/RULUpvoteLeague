import { access, isCommissioner, canSubmitLineups, signIn, signOut, leagueState, approveGM, setCommissioner, checkApproval } from './access.js';
import { TEAMS, getTeam } from './data.js';
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderAccount(container, {restricted = false, toast = () => {}} = {}) {
  const {actor, ready, error, config} = access();
  const signedIn = actor.role !== 'guest';
  const commissioner = isCommissioner();
  container.innerHTML = `<div class="page-head"><div><div class="eyebrow">LEAGUE ACCESS</div><h1>${commissioner ? 'Commissioner desk.' : 'Commissioner login.'}</h1><p class="muted">${commissioner ? 'Manage scores, lineups, trades, and account access from your private workspace.' : 'The league is public. Editing belongs to approved league staff.'}</p></div></div>
    <section class="panel account-panel"><div class="panel-header"><span class="eyebrow">${commissioner ? 'COMMISSIONER VERIFIED' : actor.role === 'gm' ? 'TEAM ACCESS' : 'PROTECTED WORKSPACE'}</span><h2>${commissioner ? 'You’re in charge.' : actor.role === 'gm' ? `${esc(getTeam(actor.teamId)?.name)} GM` : actor.role === 'pending' ? 'Waiting for commissioner approval.' : 'Sign in to manage RUL.'}</h2></div><div class="panel-body">
    ${signedIn ? `<p class="account-email">${esc(actor.email)}</p>` : '<p class="muted">Sign in with Google to request league access. The owner can approve you as a commissioner or assign you to a team.</p>'}
    ${restricted && !commissioner ? '<div class="notice">Commissioner access is required to change scores and league data.</div>' : ''}
    ${signedIn && !canSubmitLineups() ? '<div class="notice">Your request has been sent. The owner can grant commissioner access, or a commissioner can assign you to a team. You can view the league while you wait.</div>' : ''}
    ${actor.role === 'gm' ? '<p class="muted">You can submit your team’s weekly lineup. Scores and league settings belong to the commissioner.</p>' : ''}
    ${error ? `<div class="notice warning" role="status">${esc(error)}</div>` : ''}
    <div class="head-actions" style="margin-top:24px">${!signedIn ? `<button class="button primary" data-login ${!ready ? 'disabled' : ''}>${ready ? 'Continue with Google' : 'Preparing sign-in…'}</button>` : '<button class="button secondary" data-logout>Sign out</button>'+'<button class="button secondary" data-check-approval>Refresh access</button>'}${commissioner ? '<a class="button primary" href="#desk">Enter scores ↗</a><a class="button secondary" href="#gm">Manage lineups ↗</a><a class="button secondary" href="#trades">Trade desk ↗</a>' : actor.role === 'gm' ? '<a class="button primary" href="#gm">Submit lineup ↗</a>' : ''}</div>
    <p data-account-error class="notice error" role="alert" hidden style="margin-top:20px"></p>
    </div></section>
    <div class="metrics account-permissions"><div class="metric"><span class="metric-label">PUBLIC</span><h3>View the league</h3><p class="muted">Scores, rosters, schedule, standings, and player stats.</p></div><div class="metric"><span class="metric-label">COMMISSIONERS</span><h3>Edit league data</h3><p class="muted">Approved commissioners can manage scores, lineups, trades, and GM access.</p></div><div class="metric"><span class="metric-label">ASSIGNED GMs</span><h3>Submit a lineup</h3><p class="muted">Each approved GM can edit only their own team’s lineup.</p></div></div>
    ${commissioner ? approvalHTML() : ''}
    ${config?.storage === 'local' ? '<div class="callout"><strong>Local preview</strong><p>Sign-in is verified by Google. Entries save to the local league server. Live publishing is a separate connection.</p></div>' : ''}`;
  const failure = e => { const node = container.querySelector('[data-account-error]'); if (node) { node.textContent = e.message; node.hidden = false; } else toast(e.message); };
  container.querySelector('[data-login]')?.addEventListener('click', async event => {event.currentTarget.disabled = true; try { await signIn(); } catch(e) { failure(e); const b=container.querySelector('[data-login]'); if(b)b.disabled=false; }});
  container.querySelector('[data-check-approval]')?.addEventListener('click',()=>checkApproval().catch(failure));
  container.querySelectorAll('[data-approve]').forEach(button=>button.addEventListener('click',async()=>{
    const uid=button.dataset.approve;
    const select=[...container.querySelectorAll('[data-approval-team]')].find(node=>node.dataset.approvalTeam===uid);
    button.disabled=true;
    try{await approveGM(uid,select.value||null);toast(select.value?'GM access approved.':'Team access removed.');renderAccount(container,{toast});}catch(e){failure(e);button.disabled=false;}
  }));
  container.querySelectorAll('[data-commissioner]').forEach(button=>button.addEventListener('click',async()=>{
    const uid=button.dataset.commissioner;
    const enabled=button.dataset.enabled==='true';
    button.disabled=true;
    try{await setCommissioner(uid,enabled);toast(enabled?'Commissioner access granted.':'Commissioner access removed.');renderAccount(container,{toast});}catch(e){failure(e);button.disabled=false;}
  }));
  container.querySelector('[data-refresh-approvals]')?.addEventListener('click',()=>checkApproval().then(()=>renderAccount(container,{toast})).catch(failure));
  container.querySelector('[data-logout]')?.addEventListener('click', () => signOut().catch(failure));
}

function approvalHTML(){
  const state=leagueState();const requests=Object.values(state.accessRequests||{});const owner=access().actor.isOwner===true;
  return `<section class="panel" style="margin-top:28px"><div class="panel-header"><div class="section-head"><h2>Account approvals</h2><button class="button secondary small" data-refresh-approvals>Refresh requests</button></div><p class="muted">Assign a Google account to one team. The league owner can grant or remove full commissioner access. Remove commissioner access before assigning that account to a single team.</p></div><div class="panel-body">${requests.length?requests.map(person=>{const commissioner=state.commissionerAssignments?.[person.uid]===true;return `<div class="approval-row"><div><strong class="account-email">${esc(person.email)}</strong><p class="muted">${commissioner?'Commissioner access':person.status==='approved'?'Approved GM':'Waiting for approval'}</p></div><label><span class="field-label">MANAGES</span><select data-approval-team="${esc(person.uid)}" aria-label="Team for ${esc(person.email)}" ${commissioner?'disabled':''}><option value="">${commissioner?'All teams — commissioner':'No team — waiting'}</option>${TEAMS.map(team=>`<option value="${team.id}" ${state.gmAssignments?.[person.uid]===team.id?'selected':''}>${esc(team.name)}</option>`).join('')}</select></label><div class="approval-actions"><button class="button primary" data-approve="${esc(person.uid)}" ${commissioner?'disabled':''}>${person.status==='approved'?'Update GM access':'Approve & assign'}</button>${owner?`<button class="button secondary" data-commissioner="${esc(person.uid)}" data-enabled="${commissioner?'false':'true'}">${commissioner?'Remove commissioner':'Make commissioner'}</button>`:''}</div></div>`;}).join(''):'<p class="muted">No requests yet. New Google sign-ins will appear here for your approval.</p>'}</div></section>`;
}
