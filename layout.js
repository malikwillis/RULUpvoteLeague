function rulRepairBadLocalPreviewData() {
  ['RUL_WORKING_DATA', 'RUL_LOCAL_DATA', 'RUL_PREVIEW_DATA'].forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return;
      const trimmed = String(value).trim().toLowerCase();

      if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object object]' || trimmed === '') {
        localStorage.removeItem(key);
        return;
      }

      JSON.parse(value);
    } catch (error) {
      localStorage.removeItem(key);
    }
  });
}

function applySavedTheme() {
  const saved = localStorage.getItem('RUL_THEME') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleRulTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('RUL_THEME', next);

  const button = document.querySelector('.theme-toggle');
  if (button) button.textContent = next === 'dark' ? '☀️' : '🌙';
}

applySavedTheme();

function pageHeader(data, activePage, eyebrow, title, subtitle) {
  rulRepairBadLocalPreviewData();
  applySavedTheme();

  const league = data?.league || {};

  const navItems = [
    ['index.html', 'Home'],
    ['live.html', 'Live'],
    ['games.html', 'Games'],
    ['standings.html', 'Standings'],
    ['draft-capital.html', 'Draft Capital'],
    ['transactions.html', 'Transactions'],
    ['stats.html', 'Stats'],
    ['roster.html', 'Roster'],
    ['teams.html', 'Teams']
  ];

  const oldHeader = document.querySelector('.site-header');
  if (oldHeader) oldHeader.remove();

  const header = document.createElement('header');
  header.className = 'site-header';

  const theme = document.documentElement.getAttribute('data-theme') || 'dark';

  header.innerHTML = `
    <div class="rkl-topbar">
      <button class="theme-toggle" type="button" onclick="toggleRulTheme()" aria-label="Toggle theme">${theme === 'dark' ? '☀️' : '🌙'}</button>
    </div>

    <section class="rul-hero">
      <div class="rul-logo-wrap">
        <img class="rul-logo-img" src="rul-logo.png" alt="Real Upvote League logo">
      </div>

      <div class="eyebrow">${escapeHtml(eyebrow || league.homeEyebrow || 'Real Upvote League')}</div>
      <h1>${escapeHtml(title || league.name || 'Real Upvote League')}</h1>
      <p>${escapeHtml(subtitle || league.portalLabel || "Real's #1 Upvote League")}</p>

      <nav class="topnav">
        ${navItems.map(([href, label]) => `
          <a href="${href}" class="${href === activePage ? 'active' : ''}">${escapeHtml(label)}</a>
        `).join('')}
      </nav>
    </section>
  `;

  const main = document.querySelector('main.shell') || document.querySelector('main');

  if (main && main.parentNode) {
    main.parentNode.insertBefore(header, main);
  } else {
    document.body.prepend(header);
  }
}

function pageFooter(data) {
  const oldFooter = document.querySelector('.site-footer');
  if (oldFooter) oldFooter.remove();

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `@malikwillis on Real`;

  const main = document.querySelector('main.shell') || document.querySelector('main');

  if (main && main.parentNode) {
    main.parentNode.insertBefore(footer, main.nextSibling);
  } else {
    document.body.appendChild(footer);
  }
}
