const { timingSafeEqual } = require('crypto');

function env(){
  return {
    url:process.env.SUPABASE_URL,
    key:process.env.SUPABASE_SERVICE_ROLE_KEY,
    admin:process.env.RUL_DRAFT_ADMIN_CODE || process.env.RUL_PLAYOFF_ADMIN_CODE
  };
}

function equal(a,b){
  const left=Buffer.from(String(a||''));
  const right=Buffer.from(String(b||''));
  return left.length===right.length&&timingSafeEqual(left,right);
}

async function supabase(path,options={}){
  const {url,key}=env();
  if(!url||!key) throw new Error('Playoff backend is not configured.');

  const response=await fetch(`${url}/rest/v1/${path}`,{
    ...options,
    headers:{
      apikey:key,
      Authorization:`Bearer ${key}`,
      'content-type':'application/json',
      Prefer:'return=representation',
      ...(options.headers||{})
    }
  });

  if(!response.ok) throw new Error(await response.text()||'Supabase request failed.');
  return response;
}

function normalizeTeams(list){
  const seen=new Set();
  return (Array.isArray(list)?list:[])
    .map(item=>String(item||'').trim())
    .filter(item=>item&&!seen.has(item.toLowerCase())&&(seen.add(item.toLowerCase())||true))
    .slice(0,8);
}

function normalizeGame(item,index=0){
  return {
    id:String(item.id||`playoff-${Date.now()}-${index}-${Math.random().toString(36).slice(2,7)}`),
    stage:String(item.stage||'Playoffs').trim(),
    label:String(item.label||'Playoff Game').trim(),
    teamA:String(item.teamA||'TBD').trim()||'TBD',
    teamB:String(item.teamB||'TBD').trim()||'TBD',
    date:String(item.date||'TBD').trim()||'TBD',
    teamAScore:Number(item.teamAScore||0),
    teamBScore:Number(item.teamBScore||0),
    status:String(item.status||'Scheduled').trim()||'Scheduled',
    winner:String(item.winner||'').trim()
  };
}

function toClient(row){
  if(!row){
    return {initialized:false,version:0,locked:false,selectedTeams:[],schedule:[],updatedAt:null};
  }
  return {
    initialized:true,
    version:Number(row.version||0),
    locked:!!row.locked,
    selectedTeams:Array.isArray(row.selected_teams)?row.selected_teams:[],
    schedule:Array.isArray(row.schedule)?row.schedule:[],
    updatedAt:row.updated_at||null
  };
}

async function getRow(){
  const response=await supabase('rul_playoff_state?id=eq.primary&select=*');
  const rows=await response.json();
  return rows[0]||null;
}

async function initialize(){
  const payload={
    id:'primary',
    locked:false,
    selected_teams:[],
    schedule:[],
    version:1,
    updated_at:new Date().toISOString()
  };
  const response=await supabase('rul_playoff_state?on_conflict=id',{
    method:'POST',
    headers:{Prefer:'resolution=merge-duplicates, return=representation'},
    body:JSON.stringify(payload)
  });
  const rows=await response.json();
  return rows[0];
}

async function writeRow(current,next){
  const payload={
    locked:!!next.locked,
    selected_teams:next.selectedTeams,
    schedule:next.schedule,
    version:Number(current.version||0)+1,
    updated_at:new Date().toISOString()
  };

  const response=await supabase(
    `rul_playoff_state?id=eq.primary&version=eq.${Number(current.version||0)}`,
    {method:'PATCH',body:JSON.stringify(payload)}
  );

  const rows=await response.json();
  if(!rows.length){
    const error=new Error('Playoff schedule changed in another session. Refresh and try again.');
    error.status=409;
    throw error;
  }
  return rows[0];
}

function seededBracket(teams){
  const games=[];
  const add=(stage,label,a,b)=>games.push(normalizeGame({stage,label,teamA:a,teamB:b},games.length));

  if(teams.length===2){
    add('Championship','Championship',teams[0],teams[1]);
  }else if(teams.length===4){
    add('Semifinal','Semifinal 1',teams[0],teams[3]);
    add('Semifinal','Semifinal 2',teams[1],teams[2]);
    add('Championship','Championship','Winner Semifinal 1','Winner Semifinal 2');
  }else if(teams.length===6){
    add('Play-In','Play-In 1',teams[2],teams[5]);
    add('Play-In','Play-In 2',teams[3],teams[4]);
    add('Semifinal','Semifinal 1',teams[0],'Winner Play-In 2');
    add('Semifinal','Semifinal 2',teams[1],'Winner Play-In 1');
    add('Championship','Championship','Winner Semifinal 1','Winner Semifinal 2');
  }else if(teams.length>=8){
    add('Quarterfinal','Quarterfinal 1',teams[0],teams[7]);
    add('Quarterfinal','Quarterfinal 2',teams[3],teams[4]);
    add('Quarterfinal','Quarterfinal 3',teams[1],teams[6]);
    add('Quarterfinal','Quarterfinal 4',teams[2],teams[5]);
    add('Semifinal','Semifinal 1','Winner Quarterfinal 1','Winner Quarterfinal 2');
    add('Semifinal','Semifinal 2','Winner Quarterfinal 3','Winner Quarterfinal 4');
    add('Championship','Championship','Winner Semifinal 1','Winner Semifinal 2');
  }else {
    // For 3, 5, or 7 teams, the commissioner can add custom games.
    teams.slice(0,2).forEach((team,index)=>{
      if(index===0) add('Playoffs','Opening Game',team,teams[1]||'TBD');
    });
  }

  return games;
}

module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{};
    const {admin}=env();

    if(!admin||!equal(body.adminCode,admin)){
      return res.status(401).json({error:'Invalid admin code.'});
    }

    const action=body.action;
    const payload=body.payload||{};
    let current=await getRow();
    if(!current) current=await initialize();

    const state=toClient(current);

    if(action==='saveTeams'){
      state.selectedTeams=normalizeTeams(payload.selectedTeams);
      state.schedule=(state.schedule||[]).filter(game=>{
        return state.selectedTeams.includes(game.teamA) || state.selectedTeams.includes(game.teamB) || String(game.teamA).startsWith('Winner ') || String(game.teamB).startsWith('Winner ');
      });
    }else if(action==='generateBracket'){
      if(state.locked) return res.status(409).json({error:'Playoffs are locked.'});
      if(state.selectedTeams.length<2) return res.status(400).json({error:'Select at least two playoff teams first.'});
      state.schedule=seededBracket(state.selectedTeams);
    }else if(action==='addGame'){
      if(state.locked) return res.status(409).json({error:'Playoffs are locked.'});
      const game=normalizeGame(payload,(state.schedule||[]).length);
      if(!game.teamA||!game.teamB||game.teamA==='TBD'||game.teamB==='TBD'){
        return res.status(400).json({error:'Select both teams before adding a playoff game.'});
      }
      if(!state.selectedTeams.includes(game.teamA)||!state.selectedTeams.includes(game.teamB)){
        return res.status(400).json({error:'Both teams must be selected in the playoff field first.'});
      }
      state.schedule.push(game);
    }else if(action==='setScore'){
      if(state.locked) return res.status(409).json({error:'Playoffs are locked.'});
      const game=state.schedule.find(item=>item.id===String(payload.id||''));
      if(!game) return res.status(404).json({error:'Playoff game not found.'});
      game.teamAScore=Number(payload.teamAScore||0);
      game.teamBScore=Number(payload.teamBScore||0);
      game.status='Complete';
      game.winner=game.teamAScore===game.teamBScore?'':(game.teamAScore>game.teamBScore?game.teamA:game.teamB);
    }else if(action==='removeGame'){
      if(state.locked) return res.status(409).json({error:'Playoffs are locked.'});
      state.schedule=state.schedule.filter(game=>game.id!==String(payload.id||''));
    }else if(action==='setLocked'){
      state.locked=!!payload.locked;
    }else if(action==='reset'){
      state.locked=false;
      state.selectedTeams=[];
      state.schedule=[];
    }else{
      return res.status(400).json({error:'Unsupported playoff action.'});
    }

    const row=await writeRow(current,state);
    return res.status(200).json({state:toClient(row)});
  }catch(error){
    return res.status(error.status||500).json({error:error.message||'Playoff action failed.'});
  }
};
