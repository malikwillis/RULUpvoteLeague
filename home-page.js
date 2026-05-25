loadLeagueData().then(originalData=>{
  const saved=localStorage.getItem('RUL_WORKING_DATA');
  const data=saved?JSON.parse(saved):originalData;
  pageHeader(data,'index.html','League','Central','The official RUL command center');
  pageFooter(data);
  const root=$('#homeRoot')||document.body;
  const teams=data.teams||[];
  const games=data.games||[];
  const players=buildPlayers(data);
  const teamStats=buildTeamStats(data);
  const liveGames=games.filter(g=>status(g)==='Live');
  const finals=games.filter(g=>status(g)==='Final');
  const upcoming=games.filter(g=>status(g)==='Upcoming');
  const recent=[...finals].sort((a,b)=>weekNum(b.week)-weekNum(a.week)).slice(0,5);
  const next=[...upcoming].sort((a,b)=>weekNum(a.week)-weekNum(b.week)).slice(0,5);
  const topPlayers=[...players].sort((a,b)=>b.total-a.total).slice(0,8);
  const topTeams=[...teamStats].sort((a,b)=>b.scheduleUpvotes-a.scheduleUpvotes).slice(0,6);
  const totalSchedule=teamStats.reduce((s,t)=>s+t.scheduleUpvotes,0);
  const gameCenter=liveGames.length?liveGames:next;
  const topPlayer=topPlayers[0];
  root.innerHTML=`
    <section class="card central-hero">
      <div class="hero-grid">
        <div>
          <div class="label">${esc(data.league?.portalLabel||'Upvote League Portal')}</div>
          <h1 class="hero-title">${esc(data.league?.name||'Real Upvote League')}</h1>
          <p class="muted hero-subtitle">Live scores, standings, rosters, transactions, player profiles, game logs, and league stats in one central hub.</p>
          <div class="home-actions">
            <a class="btn" href="live.html">Live Scores</a>
            <a class="btn" href="standings.html">Standings</a>
            <a class="btn" href="roster.html">Rosters</a>
            <a class="btn" href="stats.html">Stats</a>
            <a class="btn" href="transactions.html">Transactions</a>
          </div>
        </div>
        <div class="mini-card">
          <div class="label">League Status</div>
          <div class="kpi">${esc(data.league?.updatedLabel||'Updated')}</div>
          <div class="row"><span>Teams</span><strong>${fmt(teams.length)}</strong></div>
          <div class="row"><span>Live Games</span><strong>${fmt(liveGames.length)}</strong></div>
          <div class="row"><span>Final Games</span><strong>${fmt(finals.length)}</strong></div>
          <div class="row"><span>Upcoming Games</span><strong>${fmt(upcoming.length)}</strong></div>
        </div>
      </div>
    </section>
    <section class="home-section home-mini-grid">
      ${statCard('Top Player',topPlayer?`@${esc(cleanHandle(topPlayer.handle))}`:'None',topPlayer?`${fmt(topPlayer.total)} game log upvotes`:'No logs yet')}
      ${statCard('Top Team',topTeams[0]?esc(topTeams[0].name):'None',topTeams[0]?`${fmt(topTeams[0].scheduleUpvotes)} schedule upvotes`:'No scores yet')}
      ${statCard('Total Upvotes',fmt(totalSchedule),'Schedule based team total')}
      ${statCard('Current Week',esc(currentWeek(games)),liveGames.length?'Live action now':'Next games loaded')}
    </section>
    <section class="home-section">
      <div class="home-section-title"><h2 class="card-title">Game Center</h2><a class="btn" href="live.html">Full Scoreboard</a></div>
      <div class="home-two-grid">
        <article class="card"><h2>${liveGames.length?'Live Now':'Next Up'}</h2>${gameCenter.length?gameCenter.map(gameCard).join(''):'<div class="empty">No games listed.</div>'}</article>
        <article class="card"><h2>Recent Finals</h2>${recent.length?recent.map(finalCard).join(''):'<div class="empty">No finals yet.</div>'}</article>
      </div>
    </section>
    <section class="home-section home-two-grid">
      <article class="card"><div class="home-section-title"><h2 class="card-title">League Leaders</h2><a class="btn" href="stats.html">Full Stats</a></div>${topPlayers.length?topPlayers.map((p,i)=>leaderRow(i+1,playerLink(p.handle),`${teamLink(p.team)} · ${esc(p.conference||'')}`,p.total)).join(''):'<div class="empty">No player stats yet.</div>'}</article>
      <article class="card"><div class="home-section-title"><h2 class="card-title">Team Upvote Board</h2><a class="btn" href="standings.html">Standings</a></div>${topTeams.length?topTeams.map((t,i)=>leaderRow(i+1,teamLink(t.name),`${esc(t.conference||'')} · ${esc(t.record||'')} · ${t.gamesPlayed} games`,t.scheduleUpvotes)).join(''):'<div class="empty">No team scores yet.</div>'}</article>
    </section>
    <section class="home-section home-three-grid">
      <a class="card quick-link-card" href="profile.html"><div class="label">Players</div><h2>Player Directory</h2><p class="muted">Search profiles, game logs, previous teams, and live game status.</p></a>
      <a class="card quick-link-card" href="transactions.html"><div class="label">Movement</div><h2>Trade Center</h2><p class="muted">Track trades, signings, picks, and player history.</p></a>
      <a class="card quick-link-card" href="score-entry.html"><div class="label">Commissioner</div><h2>Score Entry</h2><p class="muted">Update live games, final scores, lineups, and box scores.</p></a>
    </section>
    <section class="home-section home-two-grid">
      <article class="card"><h2 class="card-title">Conference Snapshot</h2><div class="home-two-grid">${conferenceCard('East',teams)}${conferenceCard('West',teams)}</div></article>
      <article class="card"><h2 class="card-title">Latest League Moves</h2>${transactions(data)}</article>
    </section>`;
}).catch(error=>{
  const root=$('#homeRoot')||document.body;
  root.innerHTML=`<section class="card"><h2>Home page failed to load</h2><p class="muted">${esc(error.message||'Check uploaded files.')}</p></section>`;
});
function esc(v){return typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function statCard(label,value,sub){return `<article class="card"><div class="label">${esc(label)}</div><div class="kpi">${value}</div><p class="muted">${esc(sub||'')}</p></article>`;}
function status(g){const n=String(g.note||'').trim().toLowerCase();if(n==='final')return'Final';if(n==='live')return'Live';return'Upcoming';}
function weekNum(w){const m=String(w||'').match(/\d+/);return m?Number(m[0]):999;}
function currentWeek(games){const live=games.find(g=>status(g)==='Live');if(live)return live.week||'Live';const up=games.find(g=>status(g)==='Upcoming');if(up)return up.week||'Upcoming';const f=games.filter(g=>status(g)==='Final').sort((a,b)=>weekNum(b.week)-weekNum(a.week));return f[0]?.week||'Season';}
function gameCard(g){const s=status(g),a=Number(g.teamAScore||0),b=Number(g.teamBScore||0),lead=a===b?'Tied':a>b?g.teamA:g.teamB,margin=Math.abs(a-b);return `<div class="home-feed-card"><div class="score-strip"><div><strong>${teamLink(g.teamA)}</strong><div class="score-num">${fmt(a)}</div></div><div class="vs-chip"><span class="pill">${esc(s)}</span><div class="muted">${s==='Upcoming'?'Not started':`${esc(lead)} by ${fmt(margin)}`}</div></div><div class="right"><strong>${teamLink(g.teamB)}</strong><div class="score-num">${fmt(b)}</div></div></div><p class="muted">${esc(g.week||'')} · ${esc(g.date||'')} · ${esc(g.type||'')}</p></div>`;}
function finalCard(g){const a=Number(g.teamAScore||0),b=Number(g.teamBScore||0),win=a>b?g.teamA:b>a?g.teamB:'Tie',margin=Math.abs(a-b),top=topInGame(g);return `<div class="home-feed-card"><div class="row"><span><strong>${teamLink(g.teamA)} ${fmt(a)} · ${teamLink(g.teamB)} ${fmt(b)}</strong><br><span class="muted">${esc(g.week||'')} · ${esc(win)} by ${fmt(margin)}</span></span><span class="pill">Final</span></div>${top?`<p class="muted">Top player: ${playerLink(top.handle)} · ${fmt(top.upvotes)}</p>`:''}</div>`;}
function topInGame(g){const ps=[...(g.boxScore?.teamA||[]),...(g.boxScore?.teamB||[])];return ps.length?ps.sort((a,b)=>Number(b.upvotes||0)-Number(a.upvotes||0))[0]:null;}
function buildPlayers(data){return (data.teams||[]).flatMap(t=>(t.roster||[]).map(p=>{const h=cleanHandle(p.handle),log=playerLog(data,h);return{handle:h,team:t.name,conference:t.conference||'',total:log.reduce((s,x)=>s+Number(x.upvotes||0),0),liveNow:log.some(x=>x.status==='Live')}}));}
function playerLog(data,h){const target=cleanHandle(h).toLowerCase(),log=[];(data.games||[]).forEach(g=>{if(!g.boxScore)return;const s=status(g);if(s!=='Final'&&s!=='Live')return;const all=[...(g.boxScore.teamA||[]),...(g.boxScore.teamB||[])],entry=all.find(p=>cleanHandle(p.handle).toLowerCase()===target);if(entry)log.push({status:s,upvotes:Number(entry.upvotes||0)});});return log;}
function buildTeamStats(data){const stats={};(data.teams||[]).forEach(t=>stats[t.name]={name:t.name,conference:t.conference||'',record:t.record||'',conferenceRecord:t.conferenceRecord||'',scheduleUpvotes:0,gamesPlayed:0});(data.games||[]).forEach(g=>{const s=status(g);if(s!=='Final'&&s!=='Live')return;if(stats[g.teamA]){stats[g.teamA].scheduleUpvotes+=Number(g.teamAScore||0);stats[g.teamA].gamesPlayed++}if(stats[g.teamB]){stats[g.teamB].scheduleUpvotes+=Number(g.teamBScore||0);stats[g.teamB].gamesPlayed++}});return Object.values(stats);}
function leaderRow(rank,name,sub,value){return `<div class="trend-row"><span class="rank-badge">${rank}</span><span><strong>${name}</strong><br><span class="muted">${sub}</span></span><strong>${fmt(value)}</strong></div>`;}
function conferenceCard(conf,teams){const ranked=teams.filter(t=>String(t.conference||'').toLowerCase()===conf.toLowerCase()).sort((a,b)=>{const ar=parseRecord(a.record),br=parseRecord(b.record);return br.wins-ar.wins||ar.losses-br.losses||String(a.name).localeCompare(String(b.name))}).slice(0,4);return `<div class="mini-card"><div class="label">${esc(conf)}</div>${ranked.map((t,i)=>`<div class="row"><span>${i+1}. ${teamLink(t.name)}</span><strong>${esc(t.record||'')}</strong></div>`).join('')}</div>`;}
function transactions(data){const tx=(data.transactions||[]).slice(0,6);if(!tx.length)return'<div class="empty">No transactions listed.</div>';return tx.map(t=>`<div class="home-feed-card"><div class="row"><span><strong>${esc(t.title||t.type||'Transaction')}</strong><br><span class="muted">${esc(t.week||t.date||'')} · ${esc(t.type||'')}</span></span><span class="pill">Move</span></div>${t.description?`<p class="muted">${esc(t.description)}</p>`:''}</div>`).join('');}
