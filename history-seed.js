// Historical records supplied by the commissioner. These are not replayed against current ownership.
export const HISTORICAL_TRADES = [
  {id:'history-01',kind:'trade',title:'Dragons / Hustlers',text:'Dragons receive: @konnorgriffin; Hustlers S3 fifth.\nHustlers receive: @richer.'},
  {id:'history-02',kind:'rebrand',title:'Team rebrands',text:'Phantoms → Dragons\nSpiders → Supersonics\nPlague → Hustlers'},
  {id:'history-03',kind:'trade',title:'Doom / Revolution',text:'Doom receive: @mistermuyrico; Revolution S3 fifth.\nRevolution receive: @breens; @wilbus; Doom S3 third.'},
  {id:'history-04',kind:'rebrand',title:'Kittens → Doom',text:'Kittens rebranded to Doom.'},
  {id:'history-05',kind:'trade',title:'Angels / Plague',text:'Angels receive: Plague S3 sixth.\nPlague receive: @_fitzy_.'},
  {id:'history-06',kind:'trade',title:'Angels / Kittens',text:'Angels receive: Kittens S3 second and fourth.\nKittens receive: @lukeboss.'},
  {id:'history-07',kind:'trade',title:'Bandits / Revolution / Phantoms',text:'Bandits receive: @superbowl; @23jet.\nRevolution receive: @10lm; Bandits second; Bandits third.\nPhantoms receive: Bandits first; @aidan; @dayne19.'},
  {id:'history-08',kind:'trade',title:'Revolution / Kittens',text:'Revolution receive: @panther15; S3 first-round pick (original team not specified).\nKittens receive: @tase.'},
  {id:'history-09',kind:'trade',title:'Bandits / Plague',text:'Bandits receive: Pick #23; Pick #42.\nPlague receive: @jo0rdan.'},
  {id:'history-10',kind:'trade',title:'Angels / Voltage',text:'Angels receive: @meat / @🤡.\nVoltage receive: Pick #15; Angels S3 third-round pick.'},
  {id:'history-11',kind:'trade',title:'Bandits / Kittens',text:'Bandits receive: Pick #3.\nKittens receive: Pick #4; Pick #36.'},
  {id:'history-12',kind:'trade',title:'Plague / Wolverines',text:'Plague receive: Pick #16 and Pick #17.\nWolverines receive: Pick #10 and Pick #26.'}
].map(entry => ({...entry,historical:true}));
