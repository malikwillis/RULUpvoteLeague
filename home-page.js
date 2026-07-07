loadLeagueData().then(data => {
  pageHeader(data,'index.html','Official League Hub','Real Upvote League',"Real's #1 Upvote League");
  pageFooter(data);

  const root=document.getElementById('homeRoot');
  const games=data.games||[];
  const live=games.filter(game=>String(game.note||'').toLowerCase()==='live');
  const upcoming=games.filter(game=>!rulHomeFinal(game)).slice(0,3);
  const latest=[...games].filter(rulHomeFinal).slice(-4).reverse();
  const leaders=rulHomePlayers(data).sort((a,b)=>b.upvotes-a.upvotes).slice(0,5);
  const standings=rulHomeStandings(data).slice(0,5);
  const transactions=(data.transactions||[]).slice(0,5);
  const playoffs=data.playoffs||{};
  const playoffTeams=playoffs.selectedTeams||[];
  const playoffGames=(playoffs.schedule||[]).filter(game=>String(game.status||'').toLowerCase()!=='complete').slice(0,3);

  root.innerHTML=`
    <section class="card home-hero">
      <div class="label">${rulEsc(data.league?.updatedLabel||'Current Season')}</div>
      <h1 class="card-title">${rulEsc(data.league?.season||'Season 1')}</h1>
      <p>Scores, standings, team hubs, league activity, draft content, and the playoff picture in one clean RUL home.</p>
      <div class="home-actions">
        <a class="btn primary" href="games.html">Schedule</a>
        <a class="btn" href="standings.html">Standings</a>
        <a class="btn" href="playoffs.html">Playoffs</a>
        <a class="btn" href="draft-room.html">Draft Room</a>
      </div>
    </section>

    <section class="grid four section">
      <article class="card"><div class="label">Live Games</div><div class="kpi">${rulFmt(live.length)}</div><p class="muted">Current matchups</p></article>
      <article class="card"><div class="label">League Teams</div><div class="kpi">${rulFmt((data.teams||[]).length)}</div><p class="muted">Active franchises</p></article>
      <article class="card"><div class="label">Playoff Teams</div><div class="kpi">${rulFmt(playoffTeams.length)}</div><p class="muted">${playoffs.initialized?'Selected for the bracket':'Not selected yet'}</p></article>
      <article class="card"><div class="label">Draft Room</div><div class="kpi">${data.draftState?.initialized?'Live':'Ready'}</div><p class="muted">${data.draftState?.locked?'Commissioner locked':'Board available'}</p></article>
    </section>

    <section class="section">
      <div class="section-header"><span><h2>League Central</h2><p class="muted">Quick access to every RUL area.</p></span></div>
      <div class="grid three">
        ${rulQuick('Schedule','League schedule and playoff schedule in one place.','games.html')}
        ${rulQuick('Standings','Current records and conference races.','standings.html')}
        ${rulQuick('Teams','Every roster, GM, and franchise hub.','teams.html')}
        ${rulQuick('Players','Search every league profile.','players.html')}
        ${rulQuick('Playoffs','Select teams, set seeds, and build the bracket.','playoffs.html')}
        ${rulQuick('Draft Room','Current pick, available players, and draft history.','draft-room.html')}
      </div>
    </section>

    <section class="grid two section">
      <article class="card">
        <div class="section-header"><span><h2>${live.length?'Live Now':'Upcoming Games'}</h2><p class="muted">Current RUL action.</p></span><a class="btn small" href="games.html">Schedule</a></div>
        ${(live.length?live:upcoming).map(renderGameCard).join('')||'<div class="empty">No matchups are listed right now.</div>'}
      </article>
      <article class="card">
        <div class="section-header"><span><h2>Top Players</h2><p class="muted">Current roster upvote leaders.</p></span><a class="btn small" href="stats.html">All Stats</a></div>
        ${leaders.map((player,index)=>`<div class="feed-row"><span class="rank-badge">${index+1}</span><span>${rulPlayerLink(player.handle)}<br><span class="muted">${rulTeamLink(player.team)}</span></span><strong>${rulFmt(player.upvotes)}</strong></div>`).join('')||'<div class="empty">No player data is listed.</div>'}
      </article>
    </section>

    <section class="grid two section">
      <article class="card">
        <div class="section-header"><span><h2>Playoff Picture</h2><p class="muted">Separate from league stats and standings calculations.</p></span><a class="btn small" href="playoffs.html">Open</a></div>
        ${playoffTeams.length
          ? playoffTeams.map((team,index)=>`<div class="feed-row"><span class="rank-badge">${index+1}</span><span>${rulTeamLink(team)}</span><strong>Seed ${index+1}</strong></div>`).join('')
          : '<div class="empty">No playoff teams selected. Use Playoffs to choose teams and build the schedule.</div>'
        }
      </article>
      <article class="card">
        <div class="section-header"><span><h2>Next Playoff Games</h2><p class="muted">The live playoff schedule updates everywhere after commissioner changes.</p></span><a class="btn small" href="playoffs.html">Playoffs</a></div>
        ${playoffGames.length
          ? playoffGames.map(game=>`<div class="row"><span><strong>${rulEsc(game.stage||'Playoff Game')}</strong><br><span class="muted">${rulTeamLink(game.teamA||'TBD')} vs ${rulTeamLink(game.teamB||'TBD')} · ${rulEsc(game.date||'TBD')}</span></span><span class="pill">${rulEsc(game.status||'Scheduled')}</span></div>`).join('')
          : '<div class="empty">No playoff games scheduled yet.</div>'
        }
      </article>
    </section>

    <section class="grid two section">
      <article class="card">
        <div class="section-header"><span><h2>Standings Preview</h2><p class="muted">Uses your existing records and team totals.</p></span><a class="btn small" href="standings.html">Full Table</a></div>
        ${standings.map((team,index)=>`<div class="feed-row"><span class="rank-badge">${index+1}</span><span>${rulTeamLink(team.name)}<br><span class="muted">${rulEsc(team.conference||'')} Conference</span></span><strong>${rulEsc(team.record||'0-0')}</strong></div>`).join('')}
      </article>
      <article class="card">
        <div class="section-header"><span><h2>Recent Activity</h2><p class="muted">Trades, additions, and draft updates.</p></span><a class="btn small" href="transactions.html">All Activity</a></div>
        ${transactions.map(item=>`<div class="row"><span><strong>${rulEsc(item.title||'League update')}</strong><br><span class="muted">${rulEsc(item.date||'')} · ${rulEsc(item.description||item.type||'')}</span></span></div>`).join('')||'<div class="empty">No transactions yet.</div>'}
      </article>
    </section>

    <section class="section">
      <div class="section-header"><span><h2>Recent Results</h2><p class="muted">Latest completed regular-season games.</p></span><a class="btn small" href="games.html">All Games</a></div>
      <div class="grid two">${latest.map(renderGameCard).join('')||'<div class="empty">No completed games are listed.</div>'}</div>
    </section>
  `;
});

function rulEsc(value){ return typeof escapeHtml==='function'?escapeHtml(value):String(value??''); }
function rulFmt(value){ return typeof fmt==='function'?fmt(value):Number(value||0).toLocaleString(); }
function rulTeamLink(name){ return typeof teamLink==='function'?teamLink(name):rulEsc(name); }
function rulPlayerLink(handle){ return typeof playerLink==='function'?playerLink(handle):'@'+rulEsc(String(handle||'').replace(/^@/,'')); }

function rulQuick(title,text,href){
  return `<a class="card quick-card" href="${href}"><span><div class="label">${rulEsc(title)}</div><h3>${rulEsc(title)}</h3><p class="muted">${rulEsc(text)}</p></span><span class="quick-arrow">Open →</span></a>`;
}
function rulHomeFinal(game){
  const note=String(game?.note||'').toLowerCase();
  return note==='final';
}
function rulHomePlayers(data){
  return (data.teams||[]).flatMap(team=>(team.roster||[]).map(player=>({
    handle:String(player.handle||'').replace(/^@/,''),
    team:team.name,
    upvotes:Number(player.upvotes||0)
  })));
}
function rulHomeStandings(data){
  return [...(data.teams||[])].sort((a,b)=>{
    const ar=rulRecord(a.record), br=rulRecord(b.record);
    return br.pct-ar.pct || br.wins-ar.wins || Number(b.totalUpvotes||0)-Number(a.totalUpvotes||0) || String(a.name).localeCompare(String(b.name));
  });
}
function rulRecord(record){
  const match=String(record||'0-0').match(/(\d+)\s*-\s*(\d+)/);
  const wins=match?Number(match[1]):0, losses=match?Number(match[2]):0;
  return {wins,losses,pct:wins/Math.max(1,wins+losses)};
}
