const roster = (teamId, handles) => handles.map((entry, index) => {
  const [handle, note] = Array.isArray(entry) ? entry : [entry];
  return { id: `${teamId}-${String(index + 1).padStart(2, '0')}`, handle, ...(note ? { note } : {}) };
});

export const TEAMS = [
  { id: 'dragons', name: 'Dragons', abbr: 'DRG', color: '#C44753', gmHandle: '@bignutt', players: roster('dragons', [
    '@sabrinacarpneter', '@aidan', '@meeps_', '@konnorgriffin', '@josh477', '@dart_', '@pickens', '@ward', '@dayne19',
  ]) },
  { id: 'hustlers', name: 'Hustlers', abbr: 'HST', color: '#C7F36B', gmHandle: '@213.nano', players: roster('hustlers', [
    '@stanks', '@jo0rdan', '@malikwillis', '@georgie', '@richer', '@giantstodabowl',
  ]) },
  { id: 'supersonics', name: 'Supersonics', abbr: 'SUP', color: '#71CFF0', gmHandle: '@irving', players: roster('supersonics', [
    '@wytaps', '@kenunderrated', '@gurny', '@il0vesports236', '@ceedeelambfan', '@laddmcconkey15', ['@ravens', '🐦‍⬛'], '@trentgrishamdadstrength',
  ]) },
  { id: 'doom', name: 'Doom', abbr: 'DOM', color: '#AC8CFF', gmHandle: '@supaboiiii', players: roster('doom', [
    '@gfk', '@flock.ravens', '@tase', '@mrtibbselite', '@prod.jadon', '@mistermuyrico', '@malik______', '@lukeboss',
  ]) },
  { id: 'revolution', name: 'Revolution', abbr: 'REV', color: '#FB9760', gmHandle: '@theodoreknowsball', players: roster('revolution', [
    '@panther15', '@10lm', '@cardinalsred123', '@cj.vaneyk', '@breens', '@wilbus', '@tecaaa', '@ayycee_23', '@finsup46',
  ]) },
  { id: 'angels', name: 'Angels', abbr: 'ANG', color: '#F29BBE', gmHandle: '@levisburner', players: roster('angels', [
    '@bacon63', '@🤡', '@lilknip', '@sports', '@luca', '@buddy____boeheim', '@*fitzy*',
  ]) },
  { id: 'bandits', name: 'Bandits', abbr: 'BND', color: '#F5C76B', gmHandle: '@ben_rice22', players: roster('bandits', [
    ['@mclean26', 'Captain · S1 ROTY'], '@superbowl', '@23jet', '@pausedduck', '@tscholl20', '@ohtanislipss', '@toasted',
  ]) },
  { id: 'wolverines', name: 'Wolverines', abbr: 'WLV', color: '#7EABFA', gmHandle: '@uzi', players: roster('wolverines', [
    '@vern', '@🎯🎯🎯', '@michael_siani', '@jjswether', '@watergoated', '@lindor_szn', '@taad', '@moballer25',
  ]) },
];

export const PLAYERS = TEAMS.flatMap(team => team.players.map(player => ({ ...player, teamId: team.id })));
export const INITIAL_ROSTERS = Object.fromEntries(PLAYERS.map(p => [p.id, p.teamId]));
// Retain historical identities without adding them to today's active rosters.
PLAYERS.push(
  {id:'historical-67fan',handle:'@67fan',teamId:'angels',active:false,note:'Historical player'},
  {id:'historical-andy15r',handle:'@andy15r',teamId:'hustlers',active:false,note:'Historical player'}
);
const teamsById = new Map(TEAMS.map(team => [team.id, team]));
const playersById = new Map(PLAYERS.map(player => [player.id, player]));
export const getTeam = id => teamsById.get(id);
export const getPlayer = id => playersById.get(id);

// Applied on the browser only. The server validates against its per-request state.
export function applyRosterState(rosters) {
  if (!rosters) return;
  for (const player of PLAYERS) if (player.active !== false && getTeam(rosters[player.id])) player.teamId = rosters[player.id];
  for (const team of TEAMS) team.players = PLAYERS.filter(p => p.active !== false && p.teamId === team.id);
}
