function parseCSV(text){
  const rows = [];
  let row = [], value = '', inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const char = text[i], next = text[i + 1];
    if(char === '"'){
      if(inQuotes && next === '"'){ value += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if(char === ',' && !inQuotes){ row.push(value.trim()); value = ''; continue; }
    if((char === '\n' || char === '\r') && !inQuotes){
      if(char === '\r' && next === '\n') i++;
      row.push(value.trim());
      if(row.some(cell => cell !== '')) rows.push(row);
      row = []; value = '';
      continue;
    }
    value += char;
  }
  if(value.length || row.length){ row.push(value.trim()); if(row.some(cell => cell !== '')) rows.push(row); }
  return rows;
}
async function fetchCSV(url){
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), {cache:'no-store'});
  if(!res.ok) throw new Error('CSV fetch failed');
  return parseCSV(await res.text());
}
function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function rowsToObjects(rows){
  if(!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => Object.fromEntries(headers.map((h,i) => [h, row[i] ?? ''])));
}
function applySheetData(base, sheetData){
  const data = clone(base);
  if(sheetData.teams?.length){
    const objects = rowsToObjects(sheetData.teams);
    const map = new Map();
    objects.forEach(r => {
      const teamName = r.team || r.Team;
      const handle = cleanHandle(r.handle || r.player || r.Player || r.Handle);
      if(!teamName || !handle) return;
      if(!map.has(teamName)) map.set(teamName, {
        id: teamName.toLowerCase().replace(/[^a-z0-9]+/g,''),
        name: teamName,
        conference: r.conference || r.Conf || '',
        record: r.record || r.Record || '0-0',
        conferenceRecord: r.conferenceRecord || r['conference record'] || r['Conf Record'] || '0-0',
        totalUpvotes: Number(String(r.totalUpvotes || r.total || r.Total || 0).replace(/,/g,'')) || 0,
        gm: r.gm || r.GM || 'TBD',
        accent: r.accent || '#e8ff3c',
        roster: []
      });
      map.get(teamName).roster.push({handle, upvotes: Number(String(r.upvotes || r.Upvotes || 0).replace(/,/g,'')) || 0});
    });
    if(map.size) data.teams = Array.from(map.values());
  }
  if(sheetData.games?.length){
    const objects = rowsToObjects(sheetData.games);
    const games = objects.map(r => ({
      week: r.week || r.Week || '', date: r.date || r.Date || '', teamA: r.teamA || r.TeamA || r.home || r.Home || '', teamB: r.teamB || r.TeamB || r.away || r.Away || '', type: r.type || r.Type || '', teamAScore: Number(String(r.teamAScore || r.homeScore || r.TeamAScore || 0).replace(/,/g,'')) || 0, teamBScore: Number(String(r.teamBScore || r.awayScore || r.TeamBScore || 0).replace(/,/g,'')) || 0, note: r.note || r.Note || ''
    })).filter(g => g.teamA && g.teamB);
    if(games.length) data.games = games;
  }
  if(sheetData.transactions?.length){
    const tx = rowsToObjects(sheetData.transactions).map(r => ({date:r.date || r.Date || '', type:r.type || r.Type || '', title:r.title || r.Title || '', description:r.description || r.Description || ''})).filter(x => x.title);
    if(tx.length) data.transactions = tx;
  }
  return data;
}
async function loadLeagueData(){
  const base = clone(window.RUL_STATIC_DATA);
  const config = window.RUL_SHEET_CONFIG || {mode:'static'};
  if(config.mode !== 'sheets') return base;
  try{
    const entries = Object.entries(config.csv || {}).filter(([,url]) => url);
    const results = await Promise.all(entries.map(async ([name,url]) => [name, await fetchCSV(url)]));
    return applySheetData(base, Object.fromEntries(results));
  }catch(error){
    console.warn('Sheet mode failed, using static data.', error);
    return base;
  }
}
