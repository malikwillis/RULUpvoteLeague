import { TEAMS, PLAYERS, getTeam, getPlayer } from './data.js';

const MAX_SCORE = 1_000_000_000;
const normalize = value => String(value ?? '').replace(/\\+([_*])/g, '$1').trim();
const key = value => normalize(value).toLocaleLowerCase('en-US').replace(/^@ilovesports236(?=$|[\s,:-])/, '@il0vesports236');
const playersByHandle = new Map(PLAYERS.map(player => [key(player.handle), player]));
const orderedPlayers = [...PLAYERS].sort((a, b) => b.handle.length - a.handle.length);
const teamByName = value => TEAMS.find(team => [team.name, team.id, team.abbr].some(name => key(name) === key(value)));
const numeric = value => typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= MAX_SCORE;

function stripMetadata(value, player) {
  let text = normalize(value);
  if (player.handle === '@mclean26') text = text.replace(/^\s*\[C\]\s*/i, '').replace(/^\s*\(S1 ROTY\)\s*/i, '').replace(/^\s*⚾️?\s*/, '');
  if (player.handle === '@ravens') text = text.replace(/^\s*🐦‍⬛\s*/, '');
  return text.trim();
}

function playerFromField(value) {
  const text = normalize(value);
  const direct = playersByHandle.get(key(text.startsWith('@') ? text : `@${text}`));
  if (direct) return direct;
  return orderedPlayers.find(player => key(text).startsWith(key(player.handle)) && stripMetadata(text.slice(player.handle.length), player) === '');
}

function parseScore(value) {
  const text = normalize(value).replace(/\s*🔥️?\s*$/u, '').trim();
  if (/^(DNP|did not play)$/i.test(text)) return { score: null, error: null };
  if (!text) return { score: null, error: 'Missing score. Enter a whole number or DNP.' };
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return { score: null, error: 'Score must be a whole number or DNP.' };
  const score = Number(text.replaceAll(',', ''));
  if (!numeric(score)) return { score: null, error: 'Score must be between -1,000,000,000 and 1,000,000,000.' };
  return { score, error: null };
}

// Quotes may contain separators; doubled quotes represent one literal quote.
function splitFields(line, delimiter) {
  const fields = [];
  let field = '', quoted = false, closed = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === delimiter) {
      fields.push(field.trim()); field = ''; closed = false;
    } else if (char === '"') {
      if (field.trim() || closed) return { error: 'Invalid quoted field.' };
      quoted = true;
    } else {
      if (closed && char.trim()) return { error: 'Unexpected text after a quoted field.' };
      field += char;
    }
  }
  if (quoted) return { error: 'Unclosed quoted field.' };
  fields.push(field.trim());
  return { fields };
}

const playerHeaders = new Set(['player', 'handle', 'username', 'name']);
const scoreHeaders = new Set(['score', 'points', 'total', 'upvotes']);
function getHeader(fields) {
  const names = fields.map(key);
  const player = names.findIndex(name => playerHeaders.has(name));
  const score = names.findIndex(name => scoreHeaders.has(name));
  const team = names.indexOf('team');
  return player >= 0 && score >= 0 && names.every(name => playerHeaders.has(name) || scoreHeaders.has(name) || name === 'team')
    ? { player, score, team, length: fields.length } : null;
}

function parsePlain(line) {
  const normalized = normalize(line);
  const lowered = key(normalized);
  const player = orderedPlayers.find(candidate => {
    const handle = key(candidate.handle);
    if (!lowered.startsWith(handle)) return false;
    return !normalized[handle.length] || /^[\s:,-]/.test(normalized.slice(handle.length, handle.length + 1));
  });
  if (!player) {
    const unknown = normalized.match(/^(@[^\s,:]+)(?:[\s,:]+(.*))?$/u);
    const rest = (unknown?.[2] ?? '').replace(/^[:,]\s*/, '').replace(/^-\s+/, '');
    const parsed = unknown ? parseScore(rest) : { score: null };
    return { player: null, score: parsed.score, error: ['Player not found. Use an exact roster handle.', parsed.error].filter(Boolean).join(' ') };
  }
  let rest = stripMetadata(normalized.slice(player.handle.length), player);
  // A spaced dash is a separator; an attached signed number is a penalty.
  rest = rest.replace(/^[:,]\s*/, '').replace(/^-\s+/, '');
  return { player, ...parseScore(rest) };
}

/** Parse without saving: every nonempty unrecognized line is returned for review. */
export function parseScoreText(text, teamIds = []) {
  const rows = [], warnings = [], declaredTotals = [], inferredTeams = new Set();
  const selected = new Set(Array.isArray(teamIds) ? teamIds : []);
  let context = null, header = null, headerDelimiter = null;
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index], line = normalize(raw);
    if (!line) continue;
    if (/^[-~_=]+$/.test(line) || /^🚨\s*FINAL SCORE\s*🚨$/iu.test(line)) continue;
    const winner = line.match(/^🚨\s*(.+?)\s+(?:win|wins|won)\s+by\s+([\d,]+)\s*🚨$/iu);
    if (winner && teamByName(winner[1]) && !parseScore(winner[2]).error) continue;
    const heading = line.endsWith(':') ? teamByName(line.slice(0, -1)) : null;
    if (heading) { context = heading.id; inferredTeams.add(heading.id); header = null; headerDelimiter = null; continue; }
    const total = line.match(/^TOTAL\s*:\s*(.*)$/i);
    if (total && context) {
      const parsedTotal = parseScore(total[1]);
      if (!parsedTotal.error && parsedTotal.score !== null) { declaredTotals.push({ teamId: context, total: parsedTotal.score }); continue; }
      rows.push({ line: index + 1, raw, playerId: null, teamId: context, score: null, error: 'Team total must be a whole number.' }); continue;
    }
    const delimiter = line.includes('\t') ? '\t' : ',';
    const separated = splitFields(line, delimiter);
    const detectedHeader = separated.fields && getHeader(separated.fields);
    if (detectedHeader) { header = detectedHeader; headerDelimiter = delimiter; continue; }
    let result, explicitTeam = null;
    const usesFields = header || line.includes('\t') || line.startsWith('"') || (separated.fields?.length >= 3 && separated.fields.some(field => teamByName(field)));
    if (usesFields) {
      const parsed = header ? splitFields(line, headerDelimiter) : separated;
      if (parsed.error) result = { error: parsed.error };
      else {
        const fields = parsed.fields;
        let playerField, scoreField, teamField;
        if (header) {
          if (fields.length !== header.length) result = { error: `Expected ${header.length} columns matching the header.` };
          else { playerField = fields[header.player]; scoreField = fields[header.score]; teamField = header.team >= 0 ? fields[header.team] : null; }
        } else if (fields.length === 2) [playerField, scoreField] = fields;
        else if (fields.length === 3) {
          const teamIndex = fields.findIndex(field => teamByName(field));
          const playerIndex = fields.findIndex(field => playerFromField(field));
          if (teamIndex >= 0 && playerIndex >= 0 && teamIndex !== playerIndex) {
            teamField = fields[teamIndex]; playerField = fields[playerIndex]; scoreField = fields.find((_, i) => i !== teamIndex && i !== playerIndex);
          } else result = { error: 'Use player,score,team columns with a header.' };
        } else result = { error: 'Expected player and score columns, with an optional team column.' };
        if (!result) {
          const player = playerFromField(playerField);
          if (teamField != null && teamField !== '') {
            explicitTeam = teamByName(teamField)?.id ?? null;
            if (!explicitTeam) result = { player, error: `Unknown team: ${teamField}.` };
          }
          if (!result) {
            const parsedScore = parseScore(scoreField);
            result = player ? { player, ...parsedScore } : { score: parsedScore.score, error: ['Player not found. Use an exact roster handle.', parsedScore.error].filter(Boolean).join(' ') };
          }
        }
      }
    } else result = parsePlain(line);
    const player = result.player;
    let error = result.error ?? null;
    if (!error && player && selected.size && !selected.has(player.teamId)) error = `${player.handle} is outside the selected teams.`;
    const expectedTeam = explicitTeam || context;
    if (!error && player && expectedTeam && expectedTeam !== player.teamId) error = `${player.handle} belongs to ${getTeam(player.teamId).name}, not ${getTeam(expectedTeam).name}.`;
    rows.push({ line: index + 1, raw, playerId: player?.id ?? null, teamId: player?.teamId ?? explicitTeam ?? context, score: result.score ?? null, error });
  }
  const grouped = new Map();
  for (const row of rows) if (row.playerId) grouped.set(row.playerId, [...(grouped.get(row.playerId) ?? []), row]);
  for (const duplicates of grouped.values()) {
    if (duplicates.length < 2) continue;
    const conflicting = new Set(duplicates.map(row => row.score)).size > 1;
    for (const row of duplicates) row.error = [row.error, `${conflicting ? 'Conflicting scores' : 'Duplicate player'} on lines ${duplicates.map(item => item.line).join(', ')}. Keep one row per player.`].filter(Boolean).join(' ');
  }
  if (rows.some(row => !row.error && row.score === null)) warnings.push('DNP rows do not count as games played or contribute to totals.');
  if (!rows.length) warnings.push('No score rows found. Paste player handles followed by scores.');
  for (const declared of declaredTotals) {
    const sum = rows.filter(row => row.teamId === declared.teamId && numeric(row.score)).reduce((total, row) => total + row.score, 0);
    if (sum !== declared.total) warnings.push(`${getTeam(declared.teamId).name}: pasted player scores total ${sum.toLocaleString('en-US')}, but the declared total is ${declared.total.toLocaleString('en-US')}. Review before saving.`);
  }
  return { rows, warnings, declaredTotals, teamIds: [...inferredTeams] };
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateGame(game, {rosters = null} = {}) {
  if (!game || typeof game !== 'object') return ['Game is missing.'];
  const errors = [];
  if (!Number.isSafeInteger(game.week) || game.week < 1) errors.push('Week must be a positive whole number.');
  if (!validDate(game.date)) errors.push('Enter a valid game date.');
  if (!getTeam(game.homeTeamId) || !getTeam(game.awayTeamId)) errors.push('Choose two valid teams.');
  if (game.homeTeamId === game.awayTeamId) errors.push('Choose two different teams.');
  if (!['draft', 'final'].includes(game.status)) errors.push('Game status must be draft or final.');
  if (!Array.isArray(game.scores)) return [...errors, 'Game scores must be a list.'];
  const snapshot = game.rosterSnapshot ?? rosters;
  if (snapshot && (typeof snapshot !== 'object' || Array.isArray(snapshot))) return [...errors, 'Invalid game roster.'];
  const teamFor = player => snapshot ? snapshot[player.id] : player.teamId;
  const seen = new Set();
  for (const row of game.scores) {
    if (!row || typeof row !== 'object') { errors.push('Invalid score row.'); continue; }
    const player = getPlayer(row.playerId);
    if (!player) { errors.push('A score has an unknown player.'); continue; }
    if (seen.has(row.playerId)) errors.push(`${player.handle} appears more than once.`);
    seen.add(row.playerId);
    if (teamFor(player) !== row.teamId) errors.push(`${player.handle} has an incorrect team.`);
    if (![game.homeTeamId, game.awayTeamId].includes(row.teamId)) errors.push(`${player.handle} is not on either team in this game.`);
    if (row.score !== null && !numeric(row.score)) errors.push(`${player.handle} needs a whole-number score between -1,000,000,000 and 1,000,000,000, or DNP.`);
  }
  if (game.status === 'final') {
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      if (getTeam(teamId) && !game.scores.some(row => row && row.teamId === teamId && getPlayer(row.playerId) && teamFor(getPlayer(row.playerId)) === teamId && numeric(row.score))) errors.push(`Add at least one played score for ${getTeam(teamId).name} before finalizing.`);
    }
  }
  return [...new Set(errors)];
}

export function teamTotal(game, teamId) {
  return (game.scores ?? []).reduce((sum, row) => sum + (row.teamId === teamId && numeric(row.score) ? row.score : 0), 0);
}

function finalized(games) {
  // Editing a game replaces its ID; if a restored list repeats an ID, its last revision wins.
  const unique = new Map();
  (Array.isArray(games) ? games : []).forEach((game, index) => {
    if (game && typeof game === 'object') unique.set(game.id || `missing-id-${index}`, game);
  });
  return [...unique.values()].filter(game => game.status === 'final' && validateGame(game).length === 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.week - b.week || String(a.id ?? '').localeCompare(String(b.id ?? '')));
}

export function playerStats(games) {
  const stats = new Map(PLAYERS.map(player => [player.id, { playerId: player.id, teamId: player.teamId, handle: player.handle, games: 0, total: 0, average: 0, best: null, last: null }]));
  for (const game of finalized(games)) {
    for (const score of game.scores) {
      if (!numeric(score.score)) continue;
      const row = stats.get(score.playerId);
      row.games += 1; row.total += score.score; row.best = row.best === null ? score.score : Math.max(row.best, score.score); row.last = score.score;
    }
  }
  const rows = [...stats.values()].map(row => ({ ...row, average: row.games ? row.total / row.games : 0 }));
  const qualified = rows.filter(row => row.games >= 2 && getPlayer(row.playerId)?.active !== false).sort((a, b) => a.average - b.average);
  const replacementAverage = qualified.length >= 4 ? qualified[Math.floor((qualified.length - 1) * 0.25)].average : null;
  const margins = finalized(games).map(game => Math.abs(teamTotal(game, game.homeTeamId) - teamTotal(game, game.awayTeamId))).filter(margin => margin > 0).sort((a, b) => a - b);
  const typicalWinMargin = margins.length ? margins[Math.floor(margins.length / 2)] : null;
  return rows.map(row => ({ ...row, replacementAverage, typicalWinMargin,
    war: row.games && replacementAverage !== null && typicalWinMargin ? (row.total - replacementAverage * row.games) / typicalWinMargin : null
  }));
}

export function standings(games) {
  const table = new Map(TEAMS.map(team => [team.id, { teamId: team.id, played: 0, wins: 0, losses: 0, ties: 0, for: 0, against: 0, diff: 0 }]));
  for (const game of finalized(games)) {
    const home = table.get(game.homeTeamId), away = table.get(game.awayTeamId);
    const homeTotal = teamTotal(game, game.homeTeamId), awayTotal = teamTotal(game, game.awayTeamId);
    home.played += 1; away.played += 1;
    home.for += homeTotal; home.against += awayTotal; away.for += awayTotal; away.against += homeTotal;
    if (homeTotal === awayTotal) { home.ties += 1; away.ties += 1; }
    else if (homeTotal > awayTotal) { home.wins += 1; away.losses += 1; }
    else { away.wins += 1; home.losses += 1; }
  }
  return [...table.values()].map(row => ({ ...row, diff: row.for - row.against }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.for - a.for || getTeam(a.teamId).name.localeCompare(getTeam(b.teamId).name));
}
