loadLeagueData().then(data => {
  pageHeader(data, 'transactions.html', 'League', 'Transactions', 'Trades, Adds & Drops');
  pageFooter(data);
  const getLocal = () => JSON.parse(localStorage.getItem('rulTransactions') || '[]');
  const allTx = () => [...data.transactions, ...getLocal()].reverse();
  const render = (filter='All') => {
    const tx = allTx().filter(item => filter === 'All' || item.type === filter);
    $('#txList').innerHTML = `<h2 class="card-title">League Activity</h2>` + (tx.length ? tx.map(item => `<div class="row"><span><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.date)} • ${escapeHtml(item.type)} • ${escapeHtml(item.description)}</span></span></div>`).join('') : '<div class="empty">No transactions found.</div>');
  };
  $all('[data-filter]').forEach(button => button.addEventListener('click', () => render(button.dataset.filter)));
  $('#openModal').addEventListener('click', () => $('#txModal').classList.add('open'));
  document.addEventListener('click', event => { if(event.target.matches('[data-close="true"]')) $('#txModal').classList.remove('open'); });
  $('#saveTx').addEventListener('click', () => {
    if($('#pass').value !== 'rulcommish'){ alert('Wrong password. Default password is rulcommish.'); return; }
    const tx = getLocal();
    tx.push({date:new Date().toLocaleDateString(), type:$('#type').value, title:$('#title').value || 'Untitled transaction', description:$('#desc').value || 'No description'});
    localStorage.setItem('rulTransactions', JSON.stringify(tx));
    $('#txModal').classList.remove('open');
    render('All');
  });
  render('All');
});
