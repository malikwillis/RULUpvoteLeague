import {access,isCommissioner,leagueState,applyLeagueTrade} from './access.js';
import {parseTradeText,transferLabel} from './trade-core.js';
import {getTeam} from './data.js';
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let draft='';let reviewed=null;
export function renderTrades(container,{toast=()=>{}}={}){
  const state=leagueState();
  container.innerHTML=`<div class="page-head"><div><div class="eyebrow">PLAYERS · PICKS · MOVES</div><h1>${isCommissioner()?'Trade desk.':'League transactions.'}</h1><p class="muted">${isCommissioner()?'Paste a trade. Check the assets. Confirm the moves.':'The league’s trades and team rebrands.'}</p></div><a class="button secondary" href="#capital">Draft capital ↗</a></div>
  ${isCommissioner()?`<section class="form-panel"><label class="field-label" for="trade-text">PASTE ONE NEW TRADE</label><textarea id="trade-text" class="import-text" rows="8" placeholder="Dragons receive:\n@malikwillis\nHustlers S3 2nd\n\nHustlers receive:\n@aidan">${esc(draft)}</textarea><p class="muted">Use each receiving team’s name, exact player handles, and the original team / season / round for picks. Both players and picks can move in the same trade.</p><div class="head-actions"><button class="button primary" data-review-trade>Review trade</button><button class="button secondary" data-clear-trade>Clear</button></div><div data-trade-review class="trade-review"></div><p class="notice error" data-trade-error role="alert" hidden></p><p class="muted">Current rosters and picks update together after confirmation. Past scores stay with the teams that earned them.</p></section>`:''}
  <section style="margin-top:30px"><div class="section-head"><h2>Transaction history</h2><span class="pill">${state.trades?.length||0} RECORDS</span></div><p class="muted">Imported history is shown as supplied. Undated past trades are recorded without reapplying them to today’s rosters or draft capital.</p>${[...(state.trades||[])].filter(t=>!t.historical).reverse().concat((state.trades||[]).filter(t=>t.historical)).map(trade=>`<article class="panel" style="margin-bottom:16px"><div class="panel-body"><div class="eyebrow">${trade.historical?'IMPORTED HISTORY':esc(new Date(trade.createdAt).toLocaleDateString('en-US'))}</div><h3>${esc(trade.title||'Trade completed')}</h3><p style="white-space:pre-line;line-height:1.7">${esc(trade.text)}</p></div></article>`).join('')}</section>`;
  if(!isCommissioner())return;
  const textarea=container.querySelector('#trade-text');
  const error=message=>{const node=container.querySelector('[data-trade-error]');node.textContent=message;node.hidden=false;};
  textarea.addEventListener('input',()=>{draft=textarea.value;reviewed=null;container.querySelector('[data-trade-review]').innerHTML='';container.querySelector('[data-trade-error]').hidden=true;});
  container.querySelector('[data-clear-trade]').onclick=()=>{draft='';reviewed=null;renderTrades(container,{toast});};
  container.querySelector('[data-review-trade]').onclick=()=>{
    draft=textarea.value;const result=parseTradeText(draft,leagueState());
    container.querySelector('[data-trade-error]').hidden=true;
    if(result.errors.length){reviewed=null;container.querySelector('[data-trade-review]').innerHTML='';error(result.errors.join(' '));return;}
    reviewed={text:draft,revision:leagueState().revision};
    container.querySelector('[data-trade-review]').innerHTML=`<h3>Review these moves</h3><ul>${result.transfers.map(t=>`<li><strong>${esc(transferLabel(t,leagueState()))}</strong>: ${esc(getTeam(t.fromTeamId).name)} → ${esc(getTeam(t.toTeamId).name)}</li>`).join('')}</ul><button class="button primary" data-confirm-trade>Confirm trade & update teams</button>`;
    container.querySelector('[data-confirm-trade]').onclick=async event=>{
      if(!reviewed||reviewed.text!==textarea.value){error('Review the updated text first.');return;}
      const submission=reviewed;event.currentTarget.disabled=true;
      try{await applyLeagueTrade(submission.text,submission.revision);draft='';reviewed=null;toast('Trade completed. Rosters and draft capital are updated.');renderTrades(container,{toast});}
      catch(e){error(e.message);const button=container.querySelector('[data-confirm-trade]');if(button)button.disabled=false;}
    };
  };
}
