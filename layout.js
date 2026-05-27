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

function ensureRulHeaderStyle() {
  if (document.getElementById('rulHeaderCenterFix')) return;

  const style = document.createElement('style');
  style.id = 'rulHeaderCenterFix';
  style.textContent = `
    html,
    body {
      overflow-x: hidden !important;
    }

    .site-header.rul-fixed-header {
      width: 100% !important;
      max-width: 100vw !important;
      margin: 0 auto !important;
      padding: 30px 16px 18px !important;
      box-sizing: border-box !important;
      text-align: center !important;
      display: block !important;
      position: relative !important;
      left: auto !important;
      right: auto !important;
      transform: none !important;
      overflow: hidden !important;
    }

    .site-header.rul-fixed-header .rul-header-inner {
      width: min(980px, 100%) !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
    }

    .site-header.rul-fixed-header .eyebrow,
    .site-header.rul-fixed-header h1,
    .site-header.rul-fixed-header p {
      width: 100% !important;
      max-width: 100% !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      box-sizing: border-box !important;
      text-align: center !important;
      display: block !important;
      position: static !important;
      left: auto !important;
      transform: none !important;
    }

    .site-header.rul-fixed-header .eyebrow {
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      letter-spacing: .26em !important;
    }

    .site-header.rul-fixed-header h1 {
      font-size: clamp(44px, 11vw, 78px) !important;
      line-height: .95 !important;
      white-space: normal !important;
    }

    .site-header.rul-fixed-header p {
      max-width: 760px !important;
    }

    .site-header.rul-fixed-header .topnav {
      width: 100% !important;
      max-width: 860px !important;
      margin: 18px auto 0 auto !important;
      padding: 0 !important;
      display: flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
      align-items: center !important;
      gap: 10px !important;
      text-align: center !important;
      position: static !important;
      left: auto !important;
      transform: none !important;
    }

    .site-header.rul-fixed-header .topnav a {
      flex: 0 0 auto !important;
    }

    @media (max-width: 700px) {
      .site-header.rul-fixed-header {
        padding-left: 10px !important;
        padding-right: 10px !important;
      }

      .site-header.rul-fixed-header h1 {
        font-size: clamp(42px, 10.5vw, 64px) !important;
      }

      .site-header.rul-fixed-header .topnav {
        gap: 8px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function pageHeader(data, activePage, eyebrow, title, subtitle) {
  rulRepairBadLocalPreviewData();
  ensureRulHeaderStyle();

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
  header.className = 'site-header rul-fixed-header';

  header.innerHTML = `
    <div class="rul-header-inner">
      <div class="eyebrow">${escapeHtml(eyebrow || league.updatedLabel || league.homeEyebrow || '')}</div>
      <h1>${escapeHtml(title || league.name || 'Real Upvote League')}</h1>
      <p>${escapeHtml(subtitle || league.portalLabel || '')}</p>

      <nav class="topnav">
        ${navItems.map(([href, label]) => `
          <a href="${href}" class="${href === activePage ? 'active' : ''}">${escapeHtml(label)}</a>
        `).join('')}
      </nav>
    </div>
  `;

  const main = document.querySelector('main.shell') || document.querySelector('main');

  if (main && main.parentNode) {
    main.parentNode.insertBefore(header, main);
  } else {
    document.body.prepend(header);
  }
}

function pageFooter(data) {
  const league = data?.league || {};

  const oldFooter = document.querySelector('.site-footer');
  if (oldFooter) oldFooter.remove();

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `Made for RUL by ${escapeHtml(league.madeBy || '@malikwillis')}`;

  const main = document.querySelector('main.shell') || document.querySelector('main');

  if (main && main.parentNode) {
    main.parentNode.insertBefore(footer, main.nextSibling);
  } else {
    document.body.appendChild(footer);
  }
}
