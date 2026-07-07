function parseCSV(text){
  const rows=[]; let row=[], value='', quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], next=text[i+1];
    if(c==='"'){ if(quoted && next==='"'){value+='"';i++;} else quoted=!quoted; continue; }
    if(c===',' && !quoted){ row.push(value.trim()); value=''; continue; }
    if((c==='\n'||c==='\r') && !quoted){ if(c==='\r'&&next==='\n')i++; row.push(value.trim()); if(row.some(cell=>cell!==''))rows.push(row); row=[]; value=''; continue; }
    value+=c;
  }
  if(value.length||row.length){row.push(value.trim());if(row.some(cell=>cell!==''))rows.push(row);}
  return rows;
}

function clone(value){ return JSON.parse(JSON.stringify(value)); }
function rowsToObjects(rows){ if(!rows.length)return []; const headers=rows[0].map(h=>h.trim()); return rows.slice(1).map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]??'']))); }

async function fetchCSV(url){
  const response=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error('CSV fetch failed');
  return parseCSV(await response.text());
}

/*
  This reads existing league data exactly as before. It does not rewrite existing
  team totals, player totals, standings, scores, or records.
*/
function applySheetData(base,sheetData){
  const data=clone(base);
  if(sheetData.teams?.length){
    const map=new Map();
    rowsToObjects(sheetData.teams).forEach(row=>{
      const teamName=row.team||row.Team;
      const handle=(typeof cleanHandle==='function'?cleanHandle(row.handle||row.player||row.Player||row.Handle):String(row.handle||'').replace(/^@/,'').trim());
      if(!teamName||!handle)return;
      if(!map.has(teamName))map.set(teamName,{
        id:teamName.toLowerCase().replace(/[^a-z0-9]+/g,''),
        name:teamName,
        conference:row.conference||row.Conf||'',
        record:row.record||row.Record||'0-0',
        conferenceRecord:row.conferenceRecord||row['conference record']||row['Conf Record']||'0-0',
        totalUpvotes:Number(String(row.totalUpvotes||row.total||row.Total||0).replace(/,/g,''))||0,
        gm:row.gm||row.GM||'TBD',
        accent:row.accent||'#43e3a0',
        roster:[]
      });
      map.get(teamName).roster.push({handle,upvotes:Number(String(row.upvotes||row.Upvotes||0).replace(/,/g,''))||0});
    });
    if(map.size)data.teams=Array.from(map.values());
  }

  if(sheetData.games?.length){
    const games=rowsToObjects(sheetData.games).map(row=>({
      week:row.week||row.Week||'',
      date:row.date||row.Date||'',
      teamA:row.teamA||row.TeamA||row.home||row.Home||'',
      teamB:row.teamB||row.TeamB||row.away||row.Away||'',
      type:row.type||row.Type||'',
      teamAScore:Number(String(row.teamAScore||row.homeScore||row.TeamAScore||0).replace(/,/g,''))||0,
      teamBScore:Number(String(row.teamBScore||row.awayScore||row.TeamBScore||0).replace(/,/g,''))||0,
      note:row.note||row.Note||''
    })).filter(game=>game.teamA&&game.teamB);
    if(games.length)data.games=games;
  }

  if(sheetData.transactions?.length){
    const tx=rowsToObjects(sheetData.transactions).map(row=>({
      date:row.date||row.Date||'',
      type:row.type||row.Type||'',
      title:row.title||row.Title||'',
      description:row.description||row.Description||''
    })).filter(item=>item.title);
    if(tx.length)data.transactions=tx;
  }

  return data;
}

async function rulFetchState(path){
  try {
    const response=await fetch(path+'?t='+Date.now(),{cache:'no-store'});
    if(!response.ok)return null;
    const payload=await response.json();
    return payload?.state || null;
  } catch(error) {
    return null;
  }
}

async function fetchDraftState(){ return rulFetchState('/api/draft-state'); }
async function fetchPlayoffState(){ return rulFetchState('/api/playoff-state'); }

function overlayDraftState(data,state){
  if(!state?.initialized || !Array.isArray(state.picks)) return data;
  const copy=clone(data);
  const draftTransactions=[];

  state.picks.forEach(pick=>{
    const team=copy.teams?.find(item=>item.name===pick.team);
    const handle=(typeof cleanHandle==='function'?cleanHandle(pick.player?.handle):String(pick.player?.handle||'').replace(/^@/,''));
    const norm=typeof normalize==='function'?normalize:((value)=>String(value||'').replace(/^@/,'').toLowerCase());

    if(team && !team.roster.some(player=>norm(player.handle)===norm(handle))){
      team.roster.push({
        handle,
        upvotes:Number(pick.player?.totalUpvotes||0),
        drafted:true,
        draftRound:pick.round,
        draftPick:pick.pickNumber
      });
    }

    draftTransactions.push({
      date:typeof formatDate==='function'?formatDate(pick.selectedAt):String(pick.selectedAt||''),
      type:'Draft',
      title:`${pick.team} drafted @${handle}`,
      description:`Round ${pick.round}, Pick ${pick.pickNumber}`
    });
  });

  copy.transactions=[...draftTransactions,...(copy.transactions||[])];
  copy.draftState=state;
  return copy;
}

/*
  Playoff state is deliberately stored separately from data.games and data.teams.
  It is display/scheduling state only, so saving playoff teams or playoff scores
  cannot modify existing league stats, records, standings, player totals, or roster totals.
*/
function overlayPlayoffState(data,state){
  const copy=clone(data);
  copy.playoffs=state || {
    initialized:false,
    version:0,
    locked:false,
    selectedTeams:[],
    schedule:[],
    updatedAt:null
  };
  return copy;
}

function startLeagueStateSync(initialDraft,initialPlayoffs){
  if(window.__RUL_LEAGUE_STATE_SYNC_STARTED)return;
  window.__RUL_LEAGUE_STATE_SYNC_STARTED=true;

  let draftVersion=Number(initialDraft?.version||0);
  let playoffVersion=Number(initialPlayoffs?.version||0);

  window.setInterval(async()=>{
    const [nextDraft,nextPlayoffs]=await Promise.all([fetchDraftState(),fetchPlayoffState()]);
    const nextDraftVersion=Number(nextDraft?.version||0);
    const nextPlayoffVersion=Number(nextPlayoffs?.version||0);
    const draftChanged=nextDraftVersion && nextDraftVersion!==draftVersion;
    const playoffChanged=nextPlayoffVersion && nextPlayoffVersion!==playoffVersion;

    if(!draftChanged&&!playoffChanged)return;

    if(draftChanged){
      draftVersion=nextDraftVersion;
      window.RUL_DRAFT_STATE=nextDraft;
      window.dispatchEvent(new CustomEvent('rul:draft-updated',{detail:nextDraft}));
    }

    if(playoffChanged){
      playoffVersion=nextPlayoffVersion;
      window.RUL_PLAYOFF_STATE=nextPlayoffs;
      window.dispatchEvent(new CustomEvent('rul:playoffs-updated',{detail:nextPlayoffs}));
    }

    if(!window.RUL_NO_AUTO_RELOAD && document.visibilityState==='visible'){
      location.reload();
    }
  },3500);
}

function readLocalPreview(){
  const keys=['RUL_WORKING_DATA','RUL_LOCAL_DATA','RUL_PREVIEW_DATA'];
  for(const key of keys){
    try{
      const raw=localStorage.getItem(key);
      if(!raw)continue;
      const parsed=JSON.parse(raw);
      if(parsed&&Array.isArray(parsed.teams)&&Array.isArray(parsed.games))return parsed;
    }catch(error){
      localStorage.removeItem(key);
    }
  }
  return null;
}

async function loadLeagueData(){
  const base=clone(window.RUL_STATIC_DATA||{});
  const config=window.RUL_SHEET_CONFIG||{mode:'static'};
  const localPreview=readLocalPreview();
  let data=localPreview?clone(localPreview):base;

  if(!localPreview&&config.mode==='sheets'){
    try{
      const entries=Object.entries(config.csv||{}).filter(([,url])=>url);
      const results=await Promise.all(entries.map(async([name,url])=>[name,await fetchCSV(url)]));
      data=applySheetData(base,Object.fromEntries(results));
    }catch(error){
      console.warn('Sheet mode failed; static data used.',error);
    }
  }

  const [draftState,playoffState]=await Promise.all([fetchDraftState(),fetchPlayoffState()]);
  window.RUL_DRAFT_STATE=draftState;
  window.RUL_PLAYOFF_STATE=playoffState;
  startLeagueStateSync(draftState,playoffState);

  data=overlayDraftState(data,draftState);
  data=overlayPlayoffState(data,playoffState);
  return data;
}
