window.RUL_NO_AUTO_RELOAD=false;
loadLeagueData().then(data=>{
  pageHeader(data,'games.html','League','Schedule','Regular season and playoff schedule, clearly separated');
  pageFooter(data);

  const root=document.getElementById('scheduleRoot');
  const regular=data.games||[];
  const playoffs=data.playoffs||{};
  const playoffGames=playoffs.schedule||[];
  const weeks=[...new Set(regular.map(game=>game.week).filter(Boolean))];
  let active='all';

  root.innerHTML=`
    <section class="card">
      <div class="section-header"><span><div class="label">Schedule Center</div><h2>RUL Schedule</h2><p class="muted">Regular-season games and commissioner-managed playoff games are intentionally kept separate. Playoff scheduling does not alter existing league stats.</p></span><a class="btn primary" href="playoffs.html">Manage Playoffs</a></div>
      <div class="toolbar">
        <select id="scheduleFilter">
          <option value="all">All regular season games</option>
          <option value="live">Live games</option>
          <option value="upcoming">Upcoming games</option>
          <option value="final">Final games</option>
          ${weeks.map(week=>`<option value="${rulEsc(week)}">${rulEsc(week)}</option>`).join('')}
        </select>
        <input id="scheduleSearch" placeholder="Search team">
      </div>
    </section>

    <section class="grid two section">
      <article class="card"><div class="label">Regular Season</div><div class="kpi">${rulFmt(regular.length)}</div><p class="muted">Existing schedule entries</p></article>
      <article class="card"><div class="label">Playoff Games</div><div class="kpi">${rulFmt(playoffGames.length)}</div><p class="muted">${playoffs.initialized?'Saved in the separate playoff schedule':'No playoff schedule built yet'}</p></article>
    </section>

    <section class="card section">
      <div class="section-header"><span><h2>Playoff Schedule</h2><p class="muted">Managed in the Playoffs page. These games do not alter player stats or regular standings.</p></span><a class="btn small" href="playoffs.html">Open Playoffs</a></div>
      <div id="playoffSchedule"></div>
    </section>

    <section class="card section">
      <div class="section-header"><span><h2>Regular Season Schedule</h2><p class="muted">Your existing games exactly as saved.</p></span></div>
      <div id="regularSchedule"></div>
    </section>
  `;

  const render=()=>{
    const term=String(document.getElementById('scheduleSearch').value||'').toLowerCase().trim();
    const filter=document.getElementById('scheduleFilter').value;
    const filtered=regular.filter(game=>{
      const note=String(game.note||'').toLowerCase();
      const match=!term||String(game.teamA||'').toLowerCase().includes(term)||String(game.teamB||'').toLowerCase().includes(term);
      const kind=filter==='all'
        || (filter==='live'&&note==='live')
        || (filter==='final'&&note==='final')
        || (filter==='upcoming'&&note!=='final'&&note!=='live')
        || filter===String(game.week||'');
      return match&&kind;
    });
    document.getElementById('regularSchedule').innerHTML=filtered.length?filtered.map(renderGameCard).join(''):'<div class="empty">No regular-season games match that filter.</div>';
  };

  document.getElementById('playoffSchedule').innerHTML=playoffGames.length
    ? playoffGames.map(rulPlayoffScheduleCard).join('')
    : '<div class="empty">No playoff games scheduled. Select playoff teams and create the schedule in Playoffs.</div>';

  document.getElementById('scheduleFilter').addEventListener('change',render);
  document.getElementById('scheduleSearch').addEventListener('input',render);
  render();
});

function rulPlayoffScheduleCard(game){
  const done=String(game.status||'').toLowerCase()==='complete';
  const a=Number(game.teamAScore||0), b=Number(game.teamBScore||0);
  return `<article class="live-row-item"><div class="live-matchup"><div><div class="team-name ${done&&a>b?'winner':''}">${rulTeamLink(game.teamA||'TBD')}</div><div class="team-score">${done?rulFmt(a):'—'}</div></div><div><div class="vs">${rulEsc(game.stage||'Playoffs')}</div><div class="diff">${rulEsc(game.date||'TBD')}</div></div><div style="text-align:right"><div class="team-name ${done&&b>a?'winner':''}">${rulTeamLink(game.teamB||'TBD')}</div><div class="team-score">${done?rulFmt(b):'—'}</div></div></div><div class="projection"><div class="proj-label">${rulEsc(game.label||'Playoff matchup')} · ${rulEsc(game.status||'Scheduled')}</div><div class="bar-wrap"><div class="bar-fill" style="width:${done?Math.round(Math.max(a,b)/Math.max(1,a+b)*100):50}%"></div></div></div></article>`;
}
function rulEsc(value){return typeof escapeHtml==='function'?escapeHtml(value):String(value??'');}
function rulFmt(value){return typeof fmt==='function'?fmt(value):Number(value||0).toLocaleString();}
function rulTeamLink(name){return typeof teamLink==='function'?teamLink(name):rulEsc(name);}
