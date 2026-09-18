import { PLAYERS } from './data.js';
import { getWeekMatchups } from './schedule.js';
// The commissioner confirmed the rebrands and requested player-score sums where posted totals differ.
const results = [
  [1,'revolution','bandits',[
    ['revolution','@panther15',1719],['revolution','@mistermuyrico',395],['revolution','@10lm',1424],['revolution','@cardinalsred123',406],
    ['bandits','@mclean26',1404],['bandits','@superbowl',948],['bandits','@23jet',2693],['bandits','@tscholl20',3699]
  ]],
  [1,'hustlers','supersonics',[
    ['hustlers','@andy15r',651],['hustlers','@jo0rdan',989],['hustlers','@georgie',1114],['hustlers','@stanks',985],
    ['supersonics','@wytaps',103],['supersonics','@kenunderrated',351],['supersonics','@laddmcconkey15',279],['supersonics','@il0vesports236',433]
  ]],
  [1,'wolverines','dragons',[
    ['wolverines','@vern',3599],['wolverines','@🎯🎯🎯',2552],['wolverines','@lindor_szn',1764],['wolverines','@michael_siani',365],
    ['dragons','@sabrinacarpneter',1055],['dragons','@dart_',0],['dragons','@meeps_',128],['dragons','@richer',0]
  ]],
  [1,'doom','angels',[
    ['doom','@tase',143],['doom','@flock.ravens',229],['doom','@mrtibbselite',872],['doom','@lukeboss',2549],
    ['angels','@bacon63',3809],['angels','@67fan',1410],['angels','@lilknip',1103],['angels','@sports',1021]
  ],'Doom’s posted total was 3,973. The commissioner approved using the player sum of 3,793.'],
  [2,'hustlers','bandits',[
    ['bandits','@mclean26',2240],['bandits','@superbowl',2261],['bandits','@tscholl20',2377],['bandits','@pausedduck',1978],
    ['hustlers','@malikwillis',607],['hustlers','@jo0rdan',1793],['hustlers','@georgie',701],['hustlers','@stanks',2258]
  ]],
  [2,'doom','dragons',[
    ['doom','@gfk',1508],['doom','@mistermuyrico',294],['doom','@mrtibbselite',1830],['doom','@lukeboss',1587],
    ['dragons','@sabrinacarpneter',3584],['dragons','@aidan',748],['dragons','@pickens',1379],['dragons','@josh477',213]
  ],'The parenthetical penalties are annotations; the listed player scores already sum to both posted totals.'],
  [2,'wolverines','revolution',[
    ['wolverines','@vern',11092],['wolverines','@🎯🎯🎯',61],['wolverines','@lindor_szn',2850],['wolverines','@taad',1310],
    ['revolution','@10lm',1341],['revolution','@panther15',1594],['revolution','@cj.vaneyk',4636],['revolution','@breens',133]
  ]],
  [2,'supersonics','angels',[
    ['supersonics','@trentgrishamdadstrength',396],['supersonics','@il0vesports236',472],['supersonics','@laddmcconkey15',342],['supersonics','@wytaps',7],
    ['angels','@bacon63',1661],['angels','@67fan',683],['angels','@lilknip',1339],['angels','@sports',813]
  ],'Angels’ posted total was 4,796. The commissioner approved using the player sum of 4,496. @ilovesports236 is the confirmed spelling alias of @il0vesports236.'],
  [3,'dragons','supersonics',[
    ['dragons','@sabrinacarpneter',2524],['dragons','@aidan',95],['dragons','@pickens',1363],['dragons','@dayne19',81],
    ['supersonics','@il0vesports236',1108],['supersonics','@trentgrishamdadstrength',256],['supersonics','@laddmcconkey15',349],['supersonics','@kenunderrated',200]
  ],'Dragons’ posted total was 4,325. The commissioner approved using the player sum of 4,063.']
];
export const SEED_GAMES = results.map(([week, first, second, rows, sourceNote]) => {
  const fixture = getWeekMatchups(week).find(g => [g.homeTeamId,g.awayTeamId].includes(first) && [g.homeTeamId,g.awayTeamId].includes(second));
  if (!fixture) throw new Error('Historical fixture not found.');
  const scores = rows.map(([teamId,handle,score]) => {
    const player = PLAYERS.find(p => p.handle === handle);
    if (!player) throw new Error(`Unknown historical player ${handle}`);
    return {teamId,playerId:player.id,score};
  });
  return {...fixture,season:'2026',status:'final',scores,rosterSnapshot:Object.fromEntries(scores.map(s => [s.playerId,s.teamId])),...(sourceNote?{sourceNote}:{})};
});
