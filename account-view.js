import { access, isCommissioner, canSubmitLineups, signIn, signOut, refreshLeague, leagueState, approveGM, checkApproval } from './access.js';
import { TEAMS, getTeam } from './data.js';
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderAccount(container, {restricted = false, toast = () => {}} = {}) {
  const {actor, ready, error, config} = access();
  const signedIn = actor.role !== 'guest';
  const commissioner = isCommissioner();
  container.innerHTML = `<div class="page-head"><div><div class="eyebrow">LEAGUE ACCESS</div><h1>${commissioner ? 'Commissioner desk.' : 'Commissioner login.'}</h1><p class="muted">${commissioner ? 'Manage scores and lineups from your private workspace.' : 'The league is public. Editing belongs to the commissioner.'}</p></div></div>
    <section class="panel account-panel"><div class="panel-header"><span class="eyebrow">${commissioner ? 'COMMISSIONER VERIFIED' : actor.role === 'gm' ? 'TEAM ACCESS' : 'PROTECTED WORKSPACE'}</span><h2>${commissioner ? 'You’re in charge.' : actor.role === 'gm' ? `${esc(getTeam(actor.teamId)?.name)} GM` : actor.role === 'pending' ? 'Waiting for commissioner approval.' : 'Sign in to manage RUL.'}</h2></div><div class="panel-body">
    ${signedIn ? `<p class="account-email">${esc(actor.email)}</p>` : '<p class="muted">Sign in with Google to request a team. The commissioner approves new accounts.</p>'}
    ${restricted && !commissioner ? '<div class="notice">Commissioner access is required to change scores and league data.</div>' : ''}
    ${signedIn && !canSubmitLineups() ? '<div class="notice">Your request has been sent. The commissioner will approve your account and select the team you manage. You can view the league while you wait.</div>' : ''}
    ${actor.role === 'gm' ? '<p class="muted">You can submit your team’s weekly lineup. Scores and league settings belong to the commissioner.</p>' : ''}
    ${error ? `<div class="notice warning" role="status">${esc(error)}</div>` : ''}
    <div class="head-actions" style="margin-top:24px">${!signedIn ? `<button class="button primary" data-login ${!ready ? 'disabled' : ''}>${ready ? 'Continue with Google' : 'Preparing sign-in…'}</button>` : '<button class="button secondary" data-logout>Sign out</button>'+(actor.role==='pending'?'<button class="button primary" data-check-approval>Check approval status</button>':'')}${commissioner ? '<a class="button primary" href="#desk">Enter scores ↗</a><a class="button secondary" href="#gm">Manage lineups ↗</a><a class="button secondary" href="#trades">Trade desk ↗</a>' : actor.role === 'gm' ? '<a class="button primary" href="#gm">Submit lineup ↗</a>' : ''}</div>
    <p data-account-error class="notice error" role="alert" hidden style="margin-top:20px"></p>
    </div></section>
    <div class="metrics account-permissions"><div class="metric"><span class="metric-label">PUBLIC</span><h3>View the league</h3><p class="muted">Scores, rosters, schedule, standings, and player stats.</p></div><div class="metric"><span class="metric-label">COMMISSIONER</span><h3>Edit league data</h3><p class="muted">Only your verified account can enter or correct scores and manage all lineups.</p></div><div class="metric"><span class="metric-label">ASSIGNED GMs</span><h3>Submit a lineup</h3><p class="muted">Each approved GM can edit only their own team’s lineup.</p></div></div>
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
  container.querySelector('[data-refresh-approvals]')?.addEventListener('click',()=>refreshLeague().then(()=>renderAccount(container,{toast})).catch(failure));
  container.querySelector('[data-logout]')?.addEventListener('click', () => signOut().catch(failure));
}

function approvalHTML(){
  const state=leagueState();const requests=Object.values(state.accessRequests||{});
  return `<section class="panel" style="margin-top:28px"><div class="panel-header"><div class="section-head"><h2>GM approvals</h2><button class="button secondary small" data-refresh-approvals>Refresh requests</button></div><p class="muted">Approve a Google account and choose its team. Accounts have no editing access until you approve them.</p></div><div class="panel-body">${requests.length?requests.map(person=>`<div class="approval-row"><div><strong class="account-email">${esc(person.email)}</strong><p class="muted">${person.status==='approved'?'Approved GM':'Waiting for commissioner approval'}</p></div><label><span class="field-label">MANAGES</span><select data-approval-team="${esc(person.uid)}" aria-label="Team for ${esc(person.email)}"><option value="">No team — waiting</option>${TEAMS.map(team=>`<option value="${team.id}" ${state.gmAssignments?.[person.uid]===team.id?'selected':''}>${esc(team.name)}</option>`).join('')}</select></label><button class="button primary" data-approve="${esc(person.uid)}">${person.status==='approved'?'Update access':'Approve & assign'}</button></div>`).join(''):'<p class="muted">No requests yet. New Google sign-ins will appear here for your approval.</p>'}</div></section>`;
}
