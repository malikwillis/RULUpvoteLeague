loadLeagueData().then(data => {
  pageHeader(data, 'transactions.html', 'League', 'Transactions', 'Trades, free agent moves, pick swaps, and commissioner notes');
  pageFooter(data);

  const target = $('#transactionsList') || $('#transactions-content') || $('#transactions');
  if (!target) return;

  const transactions = data.transactions || [];

  target.innerHTML = transactions.length ? transactions.map(tx => `
    <article class="card transaction-card">
      <div class="label">${escapeHtml(tx.week || tx.date || 'Recent')} · ${escapeHtml(tx.type || 'Transaction')}</div>
      <h2>${escapeHtml(tx.title || 'League Transaction')}</h2>
      ${tx.assets ? `
        <div class="grid two">
          ${Object.entries(tx.assets).map(([side, assets]) => `
            <div class="mini-card">
              <h3>${escapeHtml(side)}</h3>
              ${(assets || []).map(asset => `<div class="row"><span>${formatAsset(asset)}</span></div>`).join('')}
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${tx.moves && tx.moves.length ? `
        <div style="margin-top:12px">
          <h3>Player Movement</h3>
          ${tx.moves.map(move => `
            <div class="row">
              <span>${playerLink(move.player)}</span>
              <strong>${escapeHtml(move.from)} → ${escapeHtml(move.to)}</strong>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <p class="muted">${escapeHtml(tx.description || '')}</p>
    </article>
  `).join('') : '<div class="empty">No transactions entered yet.</div>';
});

function formatAsset(asset) {
  const text = String(asset || '');
  if (text.trim().startsWith('@')) {
    return playerLink(text.trim());
  }
  return escapeHtml(text);
}
