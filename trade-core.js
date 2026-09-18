import {TEAMS, PLAYERS, getTeam, getPlayer} from './data.js';
const aliases={phantoms:'dragons',kittens:'doom',spiders:'supersonics',plague:'hustlers',hustlsrs:'hustlers'};
const teamId = name => {const clean=String(name).trim().toLowerCase().replace(/^@?rul\./,'');return TEAMS.find(t=>t.name.toLowerCase()===clean||t.id===clean)?.id||aliases[clean];};
const roundWords={first:1,second:2,third:3,fourth:4,fifth:5,sixth:6};
const clean = value => String(value).replace(/&#xA0;|&#160;|&nbsp;/gi,' ').replace(/\\([_*~])/g,'$1').replace(/\*\*/g,'').replace(/\u00a0/g,' ').trim();
const roundNumber = text => roundWords[text.toLowerCase()] || Number(text.replace(/(?:st|nd|rd|th)$/i,''));
export function parseTradeText(text, state) {
  const errors=[];const transfers=[];const participants=new Set();let recipient=null;
  if(typeof text!=='string'||!text.trim())return {errors:['Paste a trade first.'],transfers:[]};
  if(text.length>20000)return {errors:['Paste one trade at a time, up to 20,000 characters.'],transfers:[]};
  const normalized=clean(text).replace(/(?:—{2,}|~{2,})/g,'\n').replace(/\b([A-Za-z]+)\s+(?:receives?|recieves?|gets?|acquires?)\s*:/gi,'\n$1 receives:\n').replace(/\s+-\s*(?=@|[A-Za-z])/g,'\n');
  const lines=normalized.split(/\r?\n|;/).flatMap(line=>line.split(/\s+(?=@)/)).map(s=>s.trim().replace(/^[-•]\s*/, '')).filter(Boolean);
  function add(kind,id,fromTeamId){
    if(!fromTeamId||!getTeam(fromTeamId)){errors.push(`No current owner found for ${id}.`);return;}
    if(fromTeamId===recipient){errors.push(`${getTeam(recipient).name} already owns ${kind==='player'?getPlayer(id).handle:'that pick'}.`);return;}
    if(transfers.some(t=>t.kind===kind&&t.id===id)){errors.push('An asset appears more than once in this trade.');return;}
    transfers.push({kind,id,fromTeamId,toTeamId:recipient});
  }
  for(const raw of lines){
    const line=raw.replace(/[,\s]+$/,'');
    const header=/^([A-Za-z]+)\s+receives:$/i.exec(line);
    if(header){recipient=teamId(header[1]);if(!recipient)errors.push(`Unknown team: ${header[1]}.`);else participants.add(recipient);continue;}
    if(!recipient){errors.push(`Add a team’s “receives:” heading before: ${line}`);continue;}
    if(line.startsWith('@')){
      const player=PLAYERS.find(p=>p.handle.toLowerCase()===line.toLowerCase());
      if(!player){errors.push(`Unknown player: ${line}. Use the exact roster handle.`);continue;}
      add('player',player.id,state.rosters?.[player.id]);continue;
    }
    const pick=/^([A-Za-z]+)\s+(?:S(\d+)\s+)?(?:(?:round|rd)\s*)?((?:[1-6](?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth)(?:\s*(?:,|&|and)\s*(?:[1-6](?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth))*)(?:\s*(?:round(?:er)?\s*)?(?:picks?)?)$/i.exec(line);
    if(pick){
      const origin=teamId(pick[1]),season=Number(pick[2]||3);
      if(!origin){errors.push(`Unknown original pick team: ${pick[1]}.`);continue;}
      for(const token of pick[3].split(/\s*(?:,|&|and)\s*/i)){
        const round=roundNumber(token);const asset=state.picks?.find(p=>p.season===season&&p.round===round&&p.originalTeamId===origin);
        if(!asset){errors.push(`Pick not found: ${getTeam(origin).name} S${season} round ${round}.`);continue;}
        add('pick',asset.id,asset.ownerTeamId);
      }
      continue;
    }
    errors.push(/(?:pick\s*#?\d|#\d)/i.test(line)?`“${line}” needs an original team and season, for example “Doom S3 2nd”.`:`Could not match: ${line}.`);
  }
  if(participants.size<2)errors.push('Include “receives:” sections for at least two teams.');
  if(transfers.some(t=>!participants.has(t.fromTeamId)))errors.push('Include a receives section for every team sending an asset.');
  if(!transfers.length)errors.push('No players or picks were matched.');
  return {errors:[...new Set(errors)],transfers,participants:[...participants]};
}
export function transferLabel(transfer,state){
  if(transfer.kind==='player')return getPlayer(transfer.id)?.handle||'Unknown player';
  const pick=state.picks?.find(p=>p.id===transfer.id);
  return pick?`${getTeam(pick.originalTeamId).name} S${pick.season} round ${pick.round}`:'Unknown pick';
}
