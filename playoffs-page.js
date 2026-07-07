window.RUL_NO_AUTO_RELOAD=true;

let rulPlayoffData;
let rulPlayoffState;
let rulPlayoffAdminCode=sessionStorage.getItem('RUL_PLAYOFF_ADMIN_CODE')||'';

loadLeagueData().then(data=>{
  rulPlayoffData=data;
  pageHeader(data,'playoffs.html','Postseason','Playoffs','Select playoff teams, set seeds, and build a separate playoff schedule');
  pageFooter(data);

  rulPlayoffState=window.RUL_PLAYOFF_STATE||rulPlayoffLocalState();
  renderPlayoffs();

  window.addEventListener('rul:playoffs-updated',event=>{
    rulPlayoffState=event.detail;
    renderPlayoffs();
  });
}).catch(error=>{
  console.error(error);
  document.getElementById('playoffsRoot').innerHTML='<section class="card"><h2>Playoffs failed to load</h2><p class="muted">Refresh and try again.</p></section>';
});

function rulPlayoffLocalState(){
  return { initialized:false, version:0, locked:false, selectedTeams:[], schedule:[], updatedAt:null };
}

function renderPlayoffs(){
  const root=document.getElementById('playoffsRoot');
  const state=rulPlayoffState||rulPlayoffLocalState();
  const teams=(rulPlayoffData.teams||[]).map(team=>team.name);
  const selected=state.selectedTeams||[];
  const schedule=state.schedule||[];

  root.innerHTML=`
    <section class="playoff-hero">
      <article class="card">
        <div class="label">RUL Postseason</div>
        <h1 class="card-title">Playoff Control Center</h1>
        <p class="muted">Choose the playoff field, set the seed order, and create matchups. Playoff selections and scores are stored separately, so they cannot alter your current player stats, regular-season standings, team totals, records, rosters, or existing schedule.</p>
        <div style="margin-top:14px"><span class="status-pill ${state.locked?'locked':'live'}">${state.locked?'Locked':'Open'}</span> <span class="status-pill">${state.initialized?'Published':'Preview'}</span></div>
      </article>
      <article class="card">
        <div class="label">Playoff Snapshot</div>
        <div class="grid two" style="margin-top:14px">
          <div class="mini-card"><div class="label">Teams</div><div class="kpi">${rulFmt(selected.length)}</div></div>
          <div class="mini-card"><div class="label">Games</div><div class="kpi">${rulFmt(schedule.length)}</div></div>
          <div class="mini-card"><div class="label">Complete</div><div class="kpi">${rulFmt(schedule.filter(game=>String(game.status||'').toLowerCase()==='complete').length)}</div></div>
          <div class="mini-card"><div class="label">Version</div><div class="kpi">${rulFmt(state.version||0)}</div></div>
        </div>
      </article>
    </section>

    <section class="grid two section">
      <article class="card">
        <div class="section-header"><span><h2>Playoff Field</h2><p class="muted">Seed 1 is the first selected team. Use the arrows to set the exact order.</p></span><a class="btn small" href="standings.html">Standings</a></div>
        <div id="playoffField"></div>
      </article>
      <article class="card">
        <div class="section-header"><span><h2>Playoff Schedule</h2><p class="muted">Team selections flow directly into the separate schedule.</p></span><a class="btn small" href="games.html">Full Schedule</a></div>
        <div id="playoffSchedulePreview"></div>
      </article>
    </section>

    <section class="card section">
      <div class="section-header"><span><h2>Bracket View</h2><p class="muted">A clear visual of all scheduled playoff matchups.</p></span></div>
      <div id="playoffBracket"></div>
    </section>

    <details class="card section" ${rulPlayoffAdminCode?'open':''}>
      <summary style="cursor:pointer;font-family:var(--display);font-size:32px;letter-spacing:.6px">Commissioner playoff controls</summary>
      <p class="muted">Viewer mode is read-only. Use the same secure admin code you use for the Draft Room. Saving playoff teams or playoff scores does not change existing stats or regular-season data.</p>

      <div class="form-grid" style="margin-top:14px">
        <input id="playoffAdminCode" type="password" placeholder="Admin code" value="${rulEsc(rulPlayoffAdminCode)}">
        <button class="btn" id="togglePlayoffLock">${state.locked?'Unlock Playoffs':'Lock Playoffs'}</button>
      </div>

      <div class="section" style="margin-top:16px">
        <div class="section-header"><span><h2>Select Playoff Teams</h2><p class="muted">Check teams that qualify. Selected teams are seeded in number order.</p></span></div>
        <div class="playoff-team-list" id="playoffTeamPicker">
          ${teams.map(team=>{
            const seed=selected.indexOf(team)+1;
            const isSelected=seed>0;
            return `<label class="playoff-team-select ${isSelected?'selected':''}">
              <input type="checkbox" data-playoff-team="${rulEsc(team)}" ${isSelected?'checked':''}>
              <span>${rulTeamLink(team)}</span>
              <span class="pill">${isSelected?`Seed ${seed}`:'Not selected'}</span>
              <input type="number" min="1" max="${teams.length}" data-playoff-seed="${rulEsc(team)}" value="${isSelected?seed:''}" placeholder="Seed" ${isSelected?'':'disabled'}>
            </label>`;
          }).join('')}
        </div>
        <div class="form-grid" style="margin-top:12px">
          <button class="btn primary" id="savePlayoffTeams">Save Playoff Teams</button>
          <button class="btn" id="generateBracket" ${selected.length<2?'disabled':''}>Generate Seeded Bracket</button>
        </div>
      </div>

      <div class="section" style="margin-top:18px">
        <div class="section-header"><span><h2>Add A Playoff Game</h2><p class="muted">Select the teams and it immediately appears on the playoff schedule.</p></span></div>
        <div class="form-grid">
          <select id="playoffStage">
            <option value="Play-In">Play-In</option>
            <option value="Quarterfinal">Quarterfinal</option>
            <option value="Semifinal">Semifinal</option>
            <option value="Championship">Championship</option>
            <option value="Custom">Custom</option>
          </select>
          <input id="playoffLabel" placeholder="Game label, e.g. Game 1">
          <select id="playoffTeamA"><option value="">Team A</option>${selected.map(team=>`<option value="${rulEsc(team)}">${rulEsc(team)}</option>`).join('')}</select>
          <select id="playoffTeamB"><option value="">Team B</option>${selected.map(team=>`<option value="${rulEsc(team)}">${rulEsc(team)}</option>`).join('')}</select>
          <input id="playoffDate" placeholder="Date / time, optional">
          <button class="btn primary" id="addPlayoffGame">Add To Schedule</button>
        </div>
      </div>

      <div class="section" style="margin-top:18px">
        <div class="section-header"><span><h2>Edit Playoff Scores</h2><p class="muted">Display-only scores. They do not touch regular season stats or records.</p></span></div>
        <div id="playoffScoreEditor"></div>
      </div>

      <div class="section" style="margin-top:18px">
        <button class="btn danger" id="resetPlayoffs">Reset Playoff Field and Schedule</button>
      </div>
    </details>
  `;

  renderPlayoffField();
  renderPlayoffSchedule();
  renderPlayoffBracket();
  renderPlayoffScoreEditor();
  bindPlayoffEvents();
}

function renderPlayoffField(){
  const selected=rulPlayoffState.selectedTeams||[];
  document.getElementById('playoffField').innerHTML=selected.length
    ? selected.map((team,index)=>`<div class="row"><span><span class="rank-badge" style="display:inline-grid;margin-right:8px">${index+1}</span>${rulTeamLink(team)}</span><span><button class="btn small" data-move-team="${rulEsc(team)}" data-direction="-1" ${index===0?'disabled':''}>↑</button> <button class="btn small" data-move-team="${rulEsc(team)}" data-direction="1" ${index===selected.length-1?'disabled':''}>↓</button></span></div>`).join('')
    : '<div class="empty">No playoff teams selected yet.</div>';
}

function renderPlayoffSchedule(){
  const games=rulPlayoffState.schedule||[];
  document.getElementById('playoffSchedulePreview').innerHTML=games.length
    ? games.map(game=>`<div class="playoff-game"><span class="playoff-seed">${rulEsc(game.stage||'P').slice(0,2)}</span><span><strong>${rulTeamLink(game.teamA||'TBD')} vs ${rulTeamLink(game.teamB||'TBD')}</strong><br><span class="muted">${rulEsc(game.label||'Playoff Game')} · ${rulEsc(game.date||'TBD')}</span></span><span class="pill">${rulEsc(game.status||'Scheduled')}</span></div>`).join('')
    : '<div class="empty">Choose playoff teams, then add a game or generate the seeded bracket.</div>';
}

function renderPlayoffBracket(){
  const games=rulPlayoffState.schedule||[];
  if(!games.length){
    document.getElementById('playoffBracket').innerHTML='<div class="empty">No bracket exists yet. Generate a seeded bracket or add custom playoff games.</div>';
    return;
  }

  const groups={};
  games.forEach(game=>{
    const stage=game.stage||'Playoffs';
    (groups[stage] ||= []).push(game);
  });

  document.getElementById('playoffBracket').innerHTML=`<div class="bracket-grid">${Object.entries(groups).map(([stage,stageGames])=>`
    <section class="bracket-column">
      <h3>${rulEsc(stage)}</h3>
      ${stageGames.map(game=>`
        <div class="bracket-match">
          <div class="bracket-team ${String(game.winner||'')===String(game.teamA||'')?'winner':''}"><span>${rulEsc(game.teamA||'TBD')}</span><strong>${game.status==='Complete'?rulFmt(game.teamAScore):'—'}</strong></div>
          <div class="bracket-team ${String(game.winner||'')===String(game.teamB||'')?'winner':''}"><span>${rulEsc(game.teamB||'TBD')}</span><strong>${game.status==='Complete'?rulFmt(game.teamBScore):'—'}</strong></div>
        </div>`).join('')}
    </section>`).join('')}</div>`;
}

function renderPlayoffScoreEditor(){
  const games=rulPlayoffState.schedule||[];
  document.getElementById('playoffScoreEditor').innerHTML=games.length
    ? games.map(game=>`<div class="playoff-game"><span class="playoff-seed">#</span><span><strong>${rulEsc(game.stage||'Playoffs')} · ${rulEsc(game.label||'Game')}</strong><br><span class="muted">${rulEsc(game.teamA||'TBD')} vs ${rulEsc(game.teamB||'TBD')}</span></span><span><button class="btn small" data-edit-score="${rulEsc(game.id)}">Edit Score</button> <button class="btn small danger" data-remove-game="${rulEsc(game.id)}">Remove</button></span></div>`).join('')
    : '<div class="empty">No playoff games available to score.</div>';
}

function bindPlayoffEvents(){
  document.getElementById('playoffAdminCode')?.addEventListener('input',event=>{
    rulPlayoffAdminCode=event.target.value;
    sessionStorage.setItem('RUL_PLAYOFF_ADMIN_CODE',rulPlayoffAdminCode);
  });

  document.querySelectorAll('[data-playoff-team]').forEach(check=>{
    check.addEventListener('change',event=>{
      const team=event.target.dataset.playoffTeam;
      const seedInput=document.querySelector(`[data-playoff-seed="${CSS.escape(team)}"]`);
      if(seedInput) seedInput.disabled=!event.target.checked;
      event.target.closest('.playoff-team-select')?.classList.toggle('selected',event.target.checked);
    });
  });

  document.getElementById('savePlayoffTeams')?.addEventListener('click',()=>{
    const selected=[];
    document.querySelectorAll('[data-playoff-team]').forEach(check=>{
      if(!check.checked)return;
      const team=check.dataset.playoffTeam;
      const seed=Number(document.querySelector(`[data-playoff-seed="${CSS.escape(team)}"]`)?.value||999);
      selected.push({team,seed});
    });
    const unique=new Set(selected.map(item=>item.seed));
    if(unique.size!==selected.length) return alert('Every selected team needs a different seed number.');
    selected.sort((a,b)=>a.seed-b.seed);
    playoffAction('saveTeams',{selectedTeams:selected.map(item=>item.team)});
  });

  document.querySelectorAll('[data-move-team]').forEach(button=>{
    button.addEventListener('click',()=>{
      const team=button.dataset.moveTeam;
      const direction=Number(button.dataset.direction);
      const next=[...(rulPlayoffState.selectedTeams||[])];
      const index=next.indexOf(team);
      const swap=index+direction;
      if(index<0||swap<0||swap>=next.length)return;
      [next[index],next[swap]]=[next[swap],next[index]];
      playoffAction('saveTeams',{selectedTeams:next});
    });
  });

  document.getElementById('generateBracket')?.addEventListener('click',()=>playoffAction('generateBracket',{}));
  document.getElementById('togglePlayoffLock')?.addEventListener('click',()=>playoffAction('setLocked',{locked:!rulPlayoffState.locked}));
  document.getElementById('addPlayoffGame')?.addEventListener('click',()=>{
    playoffAction('addGame',{
      stage:document.getElementById('playoffStage').value,
      label:document.getElementById('playoffLabel').value,
      teamA:document.getElementById('playoffTeamA').value,
      teamB:document.getElementById('playoffTeamB').value,
      date:document.getElementById('playoffDate').value
    });
  });

  document.querySelectorAll('[data-edit-score]').forEach(button=>{
    button.addEventListener('click',()=>{
      const game=(rulPlayoffState.schedule||[]).find(item=>item.id===button.dataset.editScore);
      if(!game)return;
      const a=prompt(`${game.teamA} score`,game.teamAScore??0);
      if(a===null)return;
      const b=prompt(`${game.teamB} score`,game.teamBScore??0);
      if(b===null)return;
      playoffAction('setScore',{id:game.id,teamAScore:Number(a),teamBScore:Number(b)});
    });
  });

  document.querySelectorAll('[data-remove-game]').forEach(button=>{
    button.addEventListener('click',()=>{
      if(confirm('Remove this playoff game from the separate playoff schedule?')){
        playoffAction('removeGame',{id:button.dataset.removeGame});
      }
    });
  });

  document.getElementById('resetPlayoffs')?.addEventListener('click',()=>{
    if(confirm('Clear every playoff team and playoff game? Existing league stats and schedule will stay untouched.')){
      playoffAction('reset',{});
    }
  });
}

async function playoffAction(action,payload){
  if(!rulPlayoffAdminCode) return alert('Enter the admin code first.');
  const response=await rulPlayoffAdmin(action,payload,rulPlayoffAdminCode);
  if(!response.ok) return alert(response.error||'Playoff action failed.');
  rulPlayoffState=response.state;
  window.RUL_PLAYOFF_STATE=response.state;
  renderPlayoffs();
}

async function rulPlayoffAdmin(action,payload,adminCode){
  try{
    const response=await fetch('/api/playoff-admin',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({action,payload,adminCode})
    });
    const json=await response.json();
    return {ok:response.ok,state:json.state,error:json.error};
  }catch(error){
    return {ok:false,error:'Playoff API is not set up yet.'};
  }
}

function rulEsc(value){return typeof escapeHtml==='function'?escapeHtml(value):String(value??'');}
function rulFmt(value){return typeof fmt==='function'?fmt(value):Number(value||0).toLocaleString();}
function rulTeamLink(name){return typeof teamLink==='function'?teamLink(name):rulEsc(name);}
