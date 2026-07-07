function rulSafeEscape(value) {
  if (typeof escapeHtml === 'function') return escapeHtml(value);
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function rulRepairBadLocalPreviewData() {
  ['RUL_WORKING_DATA', 'RUL_LOCAL_DATA', 'RUL_PREVIEW_DATA'].forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return;
      const normalized = String(value).trim().toLowerCase();
      if (!normalized || normalized === 'undefined' || normalized === 'null' || normalized === '[object object]') {
        localStorage.removeItem(key);
        return;
      }
      JSON.parse(value);
    } catch (error) {
      localStorage.removeItem(key);
    }
  });
}

function applyRulTheme() {
  const saved = localStorage.getItem('RUL_THEME') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleRulTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('RUL_THEME', next);
  const button = document.querySelector('.theme-toggle');
  if (button) button.textContent = next === 'dark' ? '☀' : '◐';
}

function rulNavItems() {
  return [
    ['index.html', 'Home'],
    ['live.html', 'Live'],
    ['games.html', 'Schedule'],
    ['standings.html', 'Standings'],
    ['teams.html', 'Teams'],
    ['players.html', 'Players'],
    ['stats.html', 'Stats'],
    ['transactions.html', 'Transactions'],
    ['playoffs.html', 'Playoffs'],
    ['draft-rankings.html', 'Rankings'],
    ['draft-room.html', 'Draft Room'],
    ['draft-picks.html', 'Draft Picks']
  ];
}

function pageHeader(data, activePage, eyebrow, title, subtitle) {
  rulRepairBadLocalPreviewData();
  applyRulTheme();

  const league = data?.league || {};
  document.querySelector('.site-header')?.remove();
  document.querySelector('.mobile-nav')?.remove();

  const header = document.createElement('header');
  header.className = 'site-header';
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const items = rulNavItems();

  header.innerHTML = `
    <div class="rul-header-top">
      <span class="rul-header-eyebrow">${rulSafeEscape(eyebrow || league.updatedLabel || 'Real Upvote League')}</span>
      <button class="theme-toggle" type="button" onclick="toggleRulTheme()" aria-label="Toggle theme">${theme === 'dark' ? '☀' : '◐'}</button>
    </div>
    <section class="rul-hero">
      <div class="rul-brand-row">
        <div class="rul-mark"><span>RUL</span></div>
        <div class="rul-league-title">${rulSafeEscape(title || league.name || 'Real Upvote League')}</div>
      </div>
      <p class="rul-subtitle">${rulSafeEscape(subtitle || league.portalLabel || "Real's #1 Upvote League")}</p>
      <nav class="topnav" aria-label="Primary navigation">
        ${items.map(([href, label]) => `<a href="${href}" class="${href === activePage ? 'active' : ''}">${rulSafeEscape(label)}</a>`).join('')}
      </nav>
    </section>
  `;

  const main = document.querySelector('main.shell') || document.querySelector('main.wrap') || document.querySelector('main');
  if (main?.parentNode) main.parentNode.insertBefore(header, main);
  else document.body.prepend(header);

  const mobile = document.createElement('nav');
  mobile.className = 'mobile-nav';
  mobile.setAttribute('aria-label', 'Mobile navigation');
  const mobileItems = [
    ['index.html', '⌂', 'Home'],
    ['games.html', '◫', 'Schedule'],
    ['standings.html', '≡', 'Stand'],
    ['playoffs.html', '✦', 'Playoffs'],
    ['draft-room.html', '⌁', 'Draft']
  ];
  mobile.innerHTML = mobileItems.map(([href, icon, label]) => `<a href="${href}" class="${href === activePage ? 'active' : ''}"><b>${icon}</b><span>${label}</span></a>`).join('');
  document.body.appendChild(mobile);
}

function pageFooter(data) {
  document.querySelector('.site-footer')?.remove();
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.textContent = `RUL League Hub · ${data?.league?.madeBy || '@malikwillis'}`;
  const main = document.querySelector('main.shell') || document.querySelector('main.wrap') || document.querySelector('main');
  if (main?.parentNode) main.parentNode.insertBefore(footer, main.nextSibling);
  else document.body.appendChild(footer);
}

function renderGameCard(game) {
  const final = typeof isFinal === 'function' ? isFinal(game) : String(game.note || '').toLowerCase() === 'final';
  const a = Number(game.teamAScore || 0);
  const b = Number(game.teamBScore || 0);
  const live = String(game.note || '').toLowerCase() === 'live';
  const status = live ? 'Live' : final ? 'Final' : (game.note || 'Upcoming');
  const total = Math.max(1, a + b);
  const pct = final || live ? Math.round((Math.max(a, b) / total) * 100) : 50;
  const aWin = final && a > b;
  const bWin = final && b > a;

  return `
    <article class="live-row-item">
      <div class="live-matchup">
        <div>
          <div class="team-name ${aWin ? 'winner' : ''}">${typeof teamLink === 'function' ? teamLink(game.teamA) : rulSafeEscape(game.teamA)}</div>
          <div class="team-score">${typeof fmt === 'function' ? fmt(a) : a}</div>
        </div>
        <div>
          <div class="vs">${rulSafeEscape(status)}</div>
          <div class="diff">${rulSafeEscape(game.week || '')}</div>
        </div>
        <div style="text-align:right">
          <div class="team-name ${bWin ? 'winner' : ''}">${typeof teamLink === 'function' ? teamLink(game.teamB) : rulSafeEscape(game.teamB)}</div>
          <div class="team-score">${typeof fmt === 'function' ? fmt(b) : b}</div>
        </div>
      </div>
      <div class="projection">
        <div class="proj-label">${rulSafeEscape(game.date || '')} · ${rulSafeEscape(game.type || 'League Match')}</div>
        <div class="bar-wrap"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
    </article>
  `;
}
