function aliasHandle(handle) {
  const raw = String(handle || '').replace(/^@/, '').trim();
  if (raw.toLowerCase() === '67fan/meat') return '67fan';
  return raw;
}

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function fmt(value) {
  if (value === null || value === undefined || value === '') return '0';
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n.toLocaleString() : String(value);
}

function cleanHandle(handle) {
  return aliasHandle(handle);
}

function slug(value) {
  return encodeURIComponent(String(value || ''));
}

function normalize(value) {
  return aliasHandle(value).toLowerCase();
}

function teamUrl(name) {
  return `team.html?team=${slug(name)}`;
}

function playerUrl(handle) {
  return `profile.html?player=${slug('@' + cleanHandle(handle))}`;
}

function teamLink(name) {
  return `<a href="${teamUrl(name)}">${escapeHtml(name)}</a>`;
}

function playerLink(handle) {
  return `<a href="${playerUrl(handle)}">@${escapeHtml(cleanHandle(handle))}</a>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function parseRecord(record) {
  const [wins, losses] = String(record || '0-0').split('-').map(x => Number(x) || 0);
  return { wins, losses, pct: wins / Math.max(1, wins + losses) };
}

function isFinal(game) {
  return String(game?.note || '').toLowerCase() === 'final'
    || Number(game?.teamAScore || 0) > 0
    || Number(game?.teamBScore || 0) > 0;
}

function winner(game) {
  if (!isFinal(game)) return null;
  const a = Number(game.teamAScore) || 0;
  const b = Number(game.teamBScore) || 0;
  if (a === b) return null;
  return a > b ? game.teamA : game.teamB;
}

function allPlayers(data) {
  return (data.teams || []).flatMap(team => {
    return (team.roster || []).map(player => ({
      ...player,
      handle: cleanHandle(player.handle),
      team: team.name,
      conference: team.conference,
      teamTotal: team.totalUpvotes,
      accent: team.accent
    }));
  });
}

function sortedStandings(data) {
  return [...(data.teams || [])].sort((a, b) => {
    const ar = parseRecord(a.record);
    const br = parseRecord(b.record);
    return br.wins - ar.wins
      || ar.losses - br.losses
      || Number(b.totalUpvotes || 0) - Number(a.totalUpvotes || 0)
      || a.name.localeCompare(b.name);
  });
}

function groupBy(items, key) {
  return (items || []).reduce((acc, item) => {
    const k = typeof key === 'function' ? key(item) : item[key];
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${(rows || []).map(row => `
            <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function setActiveNav(page) {
  $all('.topnav a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
}

function activateTabs() {
  $all('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.tab;
      $all('.tab').forEach(t => t.classList.remove('active'));
      $all('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const panel = $(`#tab-${id}`);
      if (panel) panel.classList.add('active');
    });
  });
}
