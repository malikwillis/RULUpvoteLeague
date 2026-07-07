const DEFAULT = {
  initialized:false,
  version:0,
  locked:false,
  selectedTeams:[],
  schedule:[],
  updatedAt:null
};

function env(){
  return {
    url:process.env.SUPABASE_URL,
    key:process.env.SUPABASE_SERVICE_ROLE_KEY
  };
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
      ...(options.headers||{})
    }
  });

  if(!response.ok) throw new Error(await response.text()||'Supabase request failed.');
  return response;
}

function toClient(row){
  if(!row) return DEFAULT;
  return {
    initialized:true,
    version:Number(row.version||0),
    locked:!!row.locked,
    selectedTeams:Array.isArray(row.selected_teams)?row.selected_teams:[],
    schedule:Array.isArray(row.schedule)?row.schedule:[],
    updatedAt:row.updated_at||null
  };
}

module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store, max-age=0');

  if(req.method!=='GET'){
    return res.status(405).json({error:'Method not allowed'});
  }

  try{
    const response=await supabase('rul_playoff_state?id=eq.primary&select=*');
    const rows=await response.json();
    return res.status(200).json({state:toClient(rows[0])});
  }catch(error){
    return res.status(200).json({state:DEFAULT,backend:false});
  }
};
