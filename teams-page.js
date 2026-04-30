loadLeagueData().then(data => {
  pageHeader(data, 'teams.html', 'League', 'Teams', 'Teams & Franchises');
  pageFooter(data);
  $('#teamGrid').innerHTML = sortedStandings(data).map(renderTeamMini).join('');
});
