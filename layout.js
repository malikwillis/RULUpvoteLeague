function pageHeader(data, activePage, eyebrow, title, subtitle) {
  const league = data?.league || {};
  const active = activePage || '';

  const navItems = [
    ['index.html', 'Home'],
    ['live.html', 'Live'],
    ['games.html', 'Games'],
    ['standings.html', 'Standings'],
    ['transactions.html', 'Transactions'],
    ['stats.html', 'Stats'],
    ['roster.html', 'Roster'],
    ['teams.html', 'Teams'],
    ['gm.html', 'GM']
  ];

  const header = document.createElement('header');
  header.className = 'site-header';

  header.innerHTML = `
    <div class="eyebrow">${escapeHtml(eyebrow || league.updatedLabel || league.homeEyebrow || '')}</div>
    <h1>${escapeHtml(title || league.name || 'Real Upvote League')}</h1>
    <p>${escapeHtml(subtitle || league.portalLabel || '')}</p>

    <nav class="topnav">
      ${navItems.map(([href, label]) => `
        <a href="${href}" class="${href === active ? 'active' : ''}">${escapeHtml(label)}</a>
      `).join('')}
    </nav>
  `;

  const main = document.querySelector('main.shell') || document.querySelector('main') || document.body;
  main.prepend(header);
}

function pageFooter(data) {
  const league = data?.league || {};
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `Made for RUL by ${escapeHtml(league.madeBy || '@malikwillis')}`;

  const main = document.querySelector('main.shell') || document.querySelector('main') || document.body;
  main.appendChild(footer);
}
