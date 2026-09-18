// Season 3 ownership supplied by the commissioner; origin stays with each pick after trades.
const holdings = {
  doom: {doom:[5,6],angels:[3],revolution:[5]},
  dragons: {dragons:[1,2,3,4,5,6],bandits:[1],hustlers:[5]},
  hustlers: {hustlers:[1,2,3,4,6]},
  bandits: {bandits:[4,5,6]},
  angels: {angels:[1,2,4,5,6],doom:[2,4]},
  revolution: {revolution:[1,2,3,4,6],doom:[1,3],bandits:[2,3]},
  wolverines: {wolverines:[1,2,3,4,5,6]},
  supersonics: {supersonics:[1,2,3,4,5,6]}
};
export const INITIAL_PICKS = Object.entries(holdings).flatMap(([ownerTeamId, origins]) => Object.entries(origins).flatMap(([originalTeamId, rounds]) => rounds.map(round => ({id:`s3-${originalTeamId}-${round}`,season:3,round,originalTeamId,ownerTeamId}))));
